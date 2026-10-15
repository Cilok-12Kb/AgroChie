import "dotenv/config";
import { describe, test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { assertTestDatabase } from "./helpers/test-db.js";

let skip = false;
try {
  assertTestDatabase();
} catch (e) {
  skip = e.message;
}
process.env.ENGINE_INTERNAL_KEY = "kunci-uji";

// GET /api/seasons/:id/weather. Open-Meteo di-stub; panggilan ke server uji diteruskan ke fetch asli.
describe("Cuaca musim (butuh database uji)", { skip }, () => {
  let server, base, prisma, clearWeatherCache, todayWib;
  const realFetch = globalThis.fetch;
  const tag = String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
  const users = {};
  const farmIds = [];
  let omCalls;
  let omResponder;
  const DAY = 86_400_000;
  const iso = (d) => new Date(d).toISOString().slice(0, 10);
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  const api = (path, cookie) => fetch(base + path, { headers: cookie ? { cookie } : {} });
  const register = async (key, digit) => {
    const phone = `0896${digit}${tag}`;
    const res = await fetch(base + "/auth/register", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Uji Cuaca " + key, phone, password: "rahasia123" }),
    });
    const b = await res.json();
    users[key] = { id: b.id, phone, cookie: (res.headers.getSetCookie()[0] ?? "").split(";")[0] };
  };
  const mkSeason = async ({ plantedOn, coords = true, crop = "BAWANG" }) => {
    const farm = await prisma.farm.create({
      data: { userId: users.a.id, areaHa: 1, ...(coords ? { latitude: "-7.123456", longitude: "110.987654" } : {}) },
    });
    farmIds.push(farm.id);
    return prisma.season.create({ data: { farmId: farm.id, crop, areaHa: 1, status: "TANAM", plantedOn } });
  };
  // Deret harian palsu: hujan 1 mm, suhu 30 derajat, untuk rentang yang diminta URL.
  const dailyBody = (u) => {
    let from, to;
    if (u.pathname === "/v1/archive") {
      from = Date.parse(u.searchParams.get("start_date"));
      to = Date.parse(u.searchParams.get("end_date"));
    } else {
      to = todayWib().getTime();
      from = to - Number(u.searchParams.get("past_days")) * DAY;
    }
    const time = [];
    for (let t = from; t <= to; t += DAY) time.push(iso(t));
    return { daily: { time, precipitation_sum: time.map(() => 1), temperature_2m_max: time.map(() => 30) } };
  };

  before(async () => {
    assertTestDatabase();
    const { app } = await import("../src/app.js");
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ clearWeatherCache } = await import("../src/services/weather.service.js"));
    ({ todayWib } = await import("../src/validators/season.validator.js"));
    await new Promise((r) => (server = app.listen(0, r)));
    base = `http://127.0.0.1:${server.address().port}/api`;
    await register("a", "1");
    await register("b", "2");
    globalThis.fetch = async (url, init) => {
      const u = new URL(String(url));
      if (u.host.endsWith("open-meteo.com")) {
        omCalls.push(u);
        return omResponder(u);
      }
      return realFetch(url, init);
    };
  });

  beforeEach(() => {
    clearWeatherCache();
    omCalls = [];
    omResponder = (u) => json(200, dailyBody(u));
  });

  after(async () => {
    globalThis.fetch = realFetch;
    if (prisma) {
      if (farmIds.length) {
        await prisma.season.deleteMany({ where: { farmId: { in: farmIds } } });
        await prisma.farm.deleteMany({ where: { id: { in: farmIds } } });
      }
      for (const u of Object.values(users)) await prisma.user.deleteMany({ where: { phone: u.phone } });
      await prisma.$disconnect();
    }
    server?.close();
  });

  test("tanpa sesi 401", async () => {
    const res = await api("/seasons/apa-saja/weather");
    assert.equal(res.status, 401);
    assert.equal(omCalls.length, 0);
  });

  test("musim milik orang lain 404, tanpa panggilan Open-Meteo", async () => {
    const s = await mkSeason({ plantedOn: new Date("2020-01-01") });
    const res = await api(`/seasons/${s.id}/weather`, users.b.cookie);
    assert.equal(res.status, 404);
    assert.equal(omCalls.length, 0);
  });

  test("plantedOn kosong -> 409 Mulai penanaman dulu", async () => {
    const s = await mkSeason({ plantedOn: null });
    const res = await api(`/seasons/${s.id}/weather`, users.a.cookie);
    assert.equal(res.status, 409);
    assert.match(JSON.stringify(await res.json()), /Mulai penanaman dulu/);
    assert.equal(omCalls.length, 0);
  });

  test("koordinat kosong -> 409 Lengkapi dulu: lokasi lahan", async () => {
    const s = await mkSeason({ plantedOn: new Date("2020-01-01"), coords: false });
    const res = await api(`/seasons/${s.id}/weather`, users.a.cookie);
    assert.equal(res.status, 409);
    assert.match(JSON.stringify(await res.json()), /Lengkapi dulu: lokasi lahan/);
    assert.equal(omCalls.length, 0);
  });

  test("musim lama (BAWANG 10 minggu): angka dihitung tangan, tidak menulis DB", async () => {
    const s = await mkSeason({ plantedOn: new Date("2020-01-01") });
    const res = await api(`/seasons/${s.id}/weather`, users.a.cookie);
    assert.equal(res.status, 200);
    const b = await res.json();
    // 70 hari x 1 mm = 7 mm per minggu; suhu 30 untuk semua hari.
    assert.deepEqual({ ...b, weeks: undefined }, {
      rainAvgMm: 7, heavyRainWks: 0, tempMaxAvg: 30, weeksCounted: 10, full: true, status: "complete", source: "Open-Meteo", weeks: undefined, // [REVISI] status musim selesai (fab968d)
    });
    assert.equal(b.weeks.length, 10);
    assert.deepEqual(b.weeks[0], { minggu: 1, rainMm: 7, tempMaxAvg: 30 });
    assert.equal(omCalls.length, 1);
    assert.equal(omCalls[0].pathname, "/v1/archive");
    assert.equal(omCalls[0].searchParams.get("latitude"), "-7.1235");
    assert.equal(omCalls[0].searchParams.get("start_date"), "2020-01-01");
    assert.equal(omCalls[0].searchParams.get("end_date"), "2020-03-10");
    const row = await prisma.season.findUnique({ where: { id: s.id } });
    assert.equal(row.status, "TANAM");
    assert.equal(row.totalCostJt, null);
  });

  test("?week=N: satu minggu saja; di luar 1..durasi -> 400", async () => {
    const s = await mkSeason({ plantedOn: new Date("2020-01-01") });
    const res = await api(`/seasons/${s.id}/weather?week=2`, users.a.cookie);
    assert.equal(res.status, 200);
    const b = await res.json();
    assert.deepEqual(b.weeks, [{ minggu: 2, rainMm: 7, tempMaxAvg: 30 }]);
    assert.equal(b.weeksCounted, 1);
    assert.equal(omCalls[0].searchParams.get("start_date"), "2020-01-08");
    assert.equal(omCalls[0].searchParams.get("end_date"), "2020-01-14");
    for (const w of ["0", "11", "abc", "1.5"]) {
      assert.equal((await api(`/seasons/${s.id}/weather?week=${w}`, users.a.cookie)).status, 400, w);
    }
  });

  test("musim berjalan: full=false dan permintaan hanya sampai kemarin", async () => {
    const today = todayWib().getTime();
    const s = await mkSeason({ plantedOn: new Date(today - 3 * DAY) });
    const b = await (await api(`/seasons/${s.id}/weather`, users.a.cookie)).json();
    assert.equal(b.full, false);
    assert.equal(b.weeksCounted, 0); // minggu 1 belum punya 7 hari data
    assert.equal(b.rainAvgMm, null);
    assert.equal(b.tempMaxAvg, 30);
    for (const u of omCalls) if (u.pathname === "/v1/archive") assert.ok(u.searchParams.get("end_date") <= iso(today - DAY));
  });

  test("Open-Meteo gagal -> 503 menyarankan isian manual", async () => {
    omResponder = () => json(500, {});
    const s = await mkSeason({ plantedOn: new Date("2020-01-01") });
    const res = await api(`/seasons/${s.id}/weather`, users.a.cookie);
    assert.equal(res.status, 503);
    assert.match(JSON.stringify(await res.json()), /manual/i);
  });

  test("panggilan kedua memakai cache (tidak fetch lagi)", async () => {
    const s = await mkSeason({ plantedOn: new Date("2020-01-01") });
    await api(`/seasons/${s.id}/weather`, users.a.cookie);
    await api(`/seasons/${s.id}/weather`, users.a.cookie);
    assert.equal(omCalls.length, 1);
  });
});

