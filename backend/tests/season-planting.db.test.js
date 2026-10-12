import "dotenv/config";
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { assertTestDatabase } from "./helpers/test-db.js";

let skip = false;
try {
  assertTestDatabase();
} catch (e) {
  skip = e.message;
}
process.env.ENGINE_INTERNAL_KEY = "kunci-uji"; // engine tidak dipanggil di tes ini

describe("Mulai penanaman (butuh database uji)", { skip }, () => {
  let server, base, prisma, todayWib;
  const tag = String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
  const users = {};
  const farmIds = [];
  const FARM = { areaHa: 1, soilType: "Lempung", waterSource: "Irigasi teknis", province: "Jawa Tengah", ph: 6, phMeasuredOn: "2026-03-01",
    nitrogen: "SEDANG", phosphorus: "SEDANG", potassium: "TINGGI" };
  const DUR = { CABAI: 16, TOMAT: 14, BAWANG: 10 };
  const iso = (d) => new Date(d).toISOString().slice(0, 10);
  const ago = (n) => iso(new Date(todayWib().getTime() - n * 86_400_000));

  const api = (method, path, cookie, body) =>
    fetch(base + path, {
      method,
      headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const register = async (key, digit) => {
    const phone = `0897${digit}${tag}`;
    const res = await api("POST", "/auth/register", null, { name: "Uji Tanam " + key, phone, password: "rahasia123" });
    const b = await res.json();
    users[key] = { id: b.id, phone, cookie: (res.headers.getSetCookie()[0] ?? "").split(";")[0] };
  };
  const mkSeason = async (crop = "CABAI", status = "PEMBIAYAAN") => {
    const farm = await (await api("POST", "/farms", users.a.cookie, { name: "F", ...FARM })).json();
    farmIds.push(farm.id);
    const s = await (await api("POST", `/farms/${farm.id}/seasons`, users.a.cookie, { crop })).json();
    if (status !== "DRAFT") await prisma.season.update({ where: { id: s.id }, data: { status } });
    return s;
  };
  const plant = (id, body, cookie = users.a.cookie) => api("POST", `/seasons/${id}/start-planting`, cookie, body);
  const statusOf = async (id) => (await prisma.season.findUnique({ where: { id } })).status;

  before(async () => {
    assertTestDatabase();
    const { app } = await import("../src/app.js");
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ todayWib } = await import("../src/validators/season.validator.js"));
    await new Promise((r) => (server = app.listen(0, r)));
    base = `http://127.0.0.1:${server.address().port}/api`;
    await register("a", "1");
    await register("b", "2");
  });

  after(async () => {
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
    assert.equal((await plant("x", {}, null)).status, 401);
  });

  test("TANAM, plantedOn terisi, minggu 1 di hari tanam, estimasi = tanam + durasi x 7 hari (tiap tanaman)", async () => {
    for (const crop of ["CABAI", "TOMAT", "BAWANG"]) {
      const s = await mkSeason(crop);
      const day = iso(todayWib());
      const res = await plant(s.id, { plantedOn: day });
      assert.equal(res.status, 200, crop);
      const b = await res.json();
      assert.equal(b.season.status, "TANAM");
      assert.equal(iso(b.season.plantedOn), day);
      assert.equal(b.currentWeek, 1);
      const expected = new Date(Date.parse(`${day}T00:00:00.000Z`) + DUR[crop] * 7 * 86_400_000);
      assert.equal(iso(b.harvestEstimate), iso(expected), crop);
      assert.equal(b.season.costPlans, undefined); // tanpa angka prediksi
    }
  });

  test("tanpa tanggal: default hari ini; tanam mundur 15 hari -> minggu 3", async () => {
    const s = await mkSeason();
    const b = await (await plant(s.id)).json();
    assert.equal(iso(b.season.plantedOn), iso(todayWib()));
    const s2 = await mkSeason();
    const b2 = await (await plant(s2.id, { plantedOn: ago(15) })).json();
    assert.equal(b2.currentWeek, 3);
  });

  test("urutan terkunci: DRAFT, TANAM, PANEN, SELESAI -> 409 dan status tidak berubah", async () => {
    for (const status of ["DRAFT", "TANAM", "PANEN", "SELESAI"]) {
      const s = await mkSeason("CABAI", status);
      assert.equal((await plant(s.id, {})).status, 409, status);
      assert.equal(await statusOf(s.id), status);
    }
  });

  test("tanggal invalid, masa depan, terlalu lama, kunci lain -> 400 dan status tetap PEMBIAYAAN", async () => {
    const s = await mkSeason();
    const future = iso(new Date(todayWib().getTime() + 2 * 86_400_000));
    for (const body of [{ plantedOn: "2026-02-31" }, { plantedOn: future }, { plantedOn: ago(61) }, { plantedOn: "abc" }, { foo: 1 }]) {
      assert.equal((await plant(s.id, body)).status, 400, JSON.stringify(body));
      assert.equal(await statusOf(s.id), "PEMBIAYAAN");
    }
    assert.equal((await prisma.season.findUnique({ where: { id: s.id } })).plantedOn, null);
  });

  test("dua permintaan berturut-turut: yang kedua 409, tanggal pertama bertahan", async () => {
    const s = await mkSeason();
    assert.equal((await plant(s.id, { plantedOn: ago(3) })).status, 200);
    assert.equal((await plant(s.id, { plantedOn: ago(0) })).status, 409);
    assert.equal(iso((await prisma.season.findUnique({ where: { id: s.id } })).plantedOn), ago(3));
  });

  test("dua permintaan bersamaan: tepat satu berhasil", async () => {
    const s = await mkSeason();
    const codes = (await Promise.all([plant(s.id, {}), plant(s.id, {})])).map((r) => r.status).sort();
    assert.deepEqual(codes, [200, 409]);
  });

  test("milik orang lain -> 404 dan status tidak berubah; id tak ada 404", async () => {
    const s = await mkSeason();
    assert.equal((await plant(s.id, {}, users.b.cookie)).status, 404);
    assert.equal(await statusOf(s.id), "PEMBIAYAAN");
    assert.equal((await plant("tidak-ada", {})).status, 404);
  });
});

