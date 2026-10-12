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
process.env.ENGINE_INTERNAL_KEY = "kunci-uji";

describe("Panen dan sampel (butuh database uji)", { skip }, () => {
  let server, base, prisma, todayWib;
  const tag = String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
  const users = {};
  const farmIds = [];
  const FARM = { areaHa: 1, soilType: "Lempung", waterSource: "Irigasi teknis", province: "Jawa Tengah", ph: 6, phMeasuredOn: "2026-03-01",
    nitrogen: "SEDANG", phosphorus: "SEDANG", potassium: "TINGGI" };
  const iso = (d) => new Date(d).toISOString().slice(0, 10);
  const ago = (n) => new Date(todayWib().getTime() - n * 86_400_000);

  const api = (method, path, cookie, body) =>
    fetch(base + path, {
      method,
      headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const register = async (key, digit) => {
    const phone = `0897${digit}${tag}`;
    const res = await api("POST", "/auth/register", null, { name: "Uji Panen " + key, phone, password: "rahasia123" });
    const b = await res.json();
    users[key] = { id: b.id, phone, cookie: (res.headers.getSetCookie()[0] ?? "").split(";")[0] };
  };
  const mkSeason = async (status = "TANAM") => {
    const farm = await (await api("POST", "/farms", users.a.cookie, { name: "F", ...FARM })).json();
    farmIds.push(farm.id);
    const s = await (await api("POST", `/farms/${farm.id}/seasons`, users.a.cookie, { crop: "CABAI" })).json();
    await prisma.season.update({ where: { id: s.id }, data: { status, plantedOn: ago(30) } });
    return s;
  };
  const hv = (over = {}) => ({ kg: "100", pricePerKg: "25000", harvestedOn: iso(ago(1)), grade: "A", ...over });
  const harvest = (id, body, cookie = users.a.cookie) => api("POST", `/seasons/${id}/harvests`, cookie, body);
  const sample = (id, body, cookie = users.a.cookie) => api("PUT", `/seasons/${id}/sample`, cookie, body);
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
        const ids = (await prisma.season.findMany({ where: { farmId: { in: farmIds } }, select: { id: true } })).map((s) => s.id);
        if (ids.length) {
          await prisma.harvest.deleteMany({ where: { seasonId: { in: ids } } });
          await prisma.harvestSample.deleteMany({ where: { seasonId: { in: ids } } });
        }
        await prisma.season.deleteMany({ where: { farmId: { in: farmIds } } });
        await prisma.farm.deleteMany({ where: { id: { in: farmIds } } });
      }
      for (const u of Object.values(users)) await prisma.user.deleteMany({ where: { phone: u.phone } });
      await prisma.$disconnect();
    }
    server?.close();
  });

  test("tanpa sesi 401", async () => {
    assert.equal((await harvest("x", hv(), null)).status, 401);
    assert.equal((await api("GET", "/seasons/x/harvests", null)).status, 401);
    assert.equal((await sample("x", { sampleKg: 1, sampleM2: 1 }, null)).status, 401);
  });

  test("validasi 400: kg dan harga > 0; tidak ada yang tersimpan, status tetap TANAM", async () => {
    const s = await mkSeason();
    const future = iso(new Date(todayWib().getTime() + 2 * 86_400_000));
    for (const b of [hv({ kg: 0 }), hv({ kg: -1 }), hv({ pricePerKg: 0 }), hv({ pricePerKg: -1 }), hv({ harvestedOn: future }),
      hv({ harvestedOn: "2026-02-31" }), hv({ grade: "Z" }), { ...hv(), foo: 1 }]) {
      assert.equal((await harvest(s.id, b)).status, 400, JSON.stringify(b));
    }
    assert.equal(await prisma.harvest.count({ where: { seasonId: s.id } }), 0);
    assert.equal(await statusOf(s.id), "TANAM");
  });

  test("panen pertama: TANAM -> PANEN; panen kedua tetap PANEN; GET urut tanggal; string Decimal", async () => {
    const s = await mkSeason();
    const r1 = await harvest(s.id, hv({ kg: "50.5", harvestedOn: iso(ago(1)) }));
    assert.equal(r1.status, 201);
    const b1 = await r1.json();
    assert.equal(b1.weightKg, "50.5");
    assert.equal(b1.pricePerKg, "25000");
    assert.equal(await statusOf(s.id), "PANEN");
    assert.equal((await harvest(s.id, hv({ harvestedOn: iso(ago(4)), grade: "B" }))).status, 201);
    assert.equal(await statusOf(s.id), "PANEN");
    const list = await (await api("GET", `/seasons/${s.id}/harvests`, users.a.cookie)).json();
    assert.deepEqual(list.map((h) => h.grade), ["B", "A"]);
  });

  test("status salah 409 untuk panen (DRAFT, PEMBIAYAAN, SELESAI) dan sampel (bukan PANEN)", async () => {
    for (const st of ["DRAFT", "PEMBIAYAAN", "SELESAI"]) {
      const s = await mkSeason(st);
      assert.equal((await harvest(s.id, hv())).status, 409, st);
      assert.equal((await sample(s.id, { sampleKg: 1, sampleM2: 1 })).status, 409, st);
      assert.equal(await prisma.harvest.count({ where: { seasonId: s.id } }), 0);
      assert.equal(await statusOf(s.id), st);
    }
    const t = await mkSeason("TANAM");
    assert.equal((await sample(t.id, { sampleKg: 1, sampleM2: 1 })).status, 409);
  });

  test("sampel: validasi 400, upsert (satu per musim), mismatch null tanpa panen", async () => {
    const s = await mkSeason("PANEN"); // PANEN tanpa entri panen
    assert.equal((await sample(s.id, { sampleKg: 0, sampleM2: 1 })).status, 400);
    assert.equal((await sample(s.id, { sampleKg: 1, sampleM2: -1 })).status, 400);
    assert.equal((await sample(s.id, { sampleKg: 1, sampleM2: 1, x: 1 })).status, 400);
    const r1 = await sample(s.id, { sampleKg: "10", sampleM2: "100" });
    assert.equal(r1.status, 200);
    const b1 = await r1.json();
    assert.equal(b1.mismatchOver30, null);
    assert.equal(b1.sampleKg, "10");
    assert.equal((await sample(s.id, { sampleKg: "20", sampleM2: "100" })).status, 200);
    assert.equal(await prisma.harvestSample.count({ where: { seasonId: s.id } }), 1);
    assert.equal((await prisma.harvestSample.findUnique({ where: { seasonId: s.id } })).sampleKg.toString(), "20");
  });

  test("ambang 30 persen: 30 persis false, di atasnya true; ikut berubah saat panen bertambah", async () => {
    // areaHa 1; sampel 10 kg / 100 m2 -> perkiraan 1000 kg
    const s = await mkSeason();
    await harvest(s.id, hv({ kg: "1300" }));
    let b = await (await sample(s.id, { sampleKg: "10", sampleM2: "100" })).json();
    assert.equal(b.mismatchOver30, false);
    assert.equal(b.totalHarvestKg, "1300");
    await harvest(s.id, hv({ kg: "0.01" }));
    b = await (await sample(s.id, { sampleKg: "10", sampleM2: "100" })).json();
    assert.equal(b.mismatchOver30, true);
    assert.equal((await prisma.harvestSample.findUnique({ where: { seasonId: s.id } })).mismatchOver30, true);
  });

  test("milik orang lain 404 untuk panen, daftar, sampel", async () => {
    const s = await mkSeason();
    assert.equal((await harvest(s.id, hv(), users.b.cookie)).status, 404);
    assert.equal((await api("GET", `/seasons/${s.id}/harvests`, users.b.cookie)).status, 404);
    assert.equal((await sample(s.id, { sampleKg: 1, sampleM2: 1 }, users.b.cookie)).status, 404);
    assert.equal(await prisma.harvest.count({ where: { seasonId: s.id } }), 0);
    assert.equal(await statusOf(s.id), "TANAM");
  });
});

