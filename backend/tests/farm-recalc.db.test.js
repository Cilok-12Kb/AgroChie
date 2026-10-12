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

describe("hook luas -> CostPlan.needsRecalc (butuh database uji)", { skip }, () => {
  let server, base, prisma;
  const rand = () => "0897" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
  const phones = [rand(), rand()];
  const users = [];
  const farmIds = [];

  const call = (method, path, body, cookie) =>
    fetch(base + path, {
      method,
      headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  const newFarm = async (userId, areaHa = "1.50") => {
    const f = await prisma.farm.create({ data: { userId, name: "Lahan Hook", areaHa } });
    farmIds.push(f.id);
    return f;
  };
  const newPlan = (seasonId, createdAt) =>
    prisma.costPlan.create({
      data: {
        seasonId, totalJt: "10", p10Jt: "8", p50Jt: "10", p90Jt: "12",
        weeklyJt: [1, 2], modelVersion: "uji", createdAt,
      },
    });
  const newSeason = (farmId, status) => prisma.season.create({ data: { farmId, crop: "CABAI", areaHa: "1.50", status } });
  const flag = async (id) => (await prisma.costPlan.findUnique({ where: { id } })).needsRecalc;

  before(async () => {
    assertTestDatabase();
    const { app } = await import("../src/app.js");
    ({ prisma } = await import("../src/config/prisma.js"));
    await new Promise((r) => (server = app.listen(0, r)));
    base = `http://127.0.0.1:${server.address().port}/api`;
    for (const phone of phones) {
      const res = await call("POST", "/auth/register", { name: "Uji Hook", phone, password: "rahasia123" });
      const body = await res.json();
      users.push({ id: body.id, cookie: (res.headers.getSetCookie()[0] ?? "").split(";")[0] });
    }
  });

  // Hapus user uji -> Farm, Season, CostPlan ikut terhapus (cascade); semua dengan filter.
  after(async () => {
    if (prisma) {
      await prisma.user.deleteMany({ where: { phone: { in: phones } } });
      await prisma.$disconnect();
    }
    server?.close();
  });

  test("luas berubah -> needsRecalc true hanya pada CostPlan terbaru Season aktif", async () => {
    const farm = await newFarm(users[0].id);
    const aktif = await newSeason(farm.id, "PEMBIAYAAN");
    const lama = await newPlan(aktif.id, new Date("2026-01-01"));
    const baru = await newPlan(aktif.id, new Date("2026-02-01"));
    const selesai = await newSeason(farm.id, "SELESAI");
    const planSelesai = await newPlan(selesai.id, new Date("2026-01-01"));

    const res = await call("PATCH", `/farms/${farm.id}`, { areaHa: 2 }, users[0].cookie);
    assert.equal(res.status, 200);
    assert.equal(await flag(baru.id), true);
    assert.equal(await flag(lama.id), false);
    assert.equal(await flag(planSelesai.id), false);
  });

  test("luas sama (nilai Decimal sama) -> tetap false", async () => {
    const farm = await newFarm(users[0].id, "1.50");
    const s = await newSeason(farm.id, "TANAM");
    const plan = await newPlan(s.id, new Date());
    assert.equal((await call("PATCH", `/farms/${farm.id}`, { areaHa: 1.5 }, users[0].cookie)).status, 200);
    assert.equal(await flag(plan.id), false);
  });

  test("ubah kolom lain -> tetap false", async () => {
    const farm = await newFarm(users[0].id);
    const s = await newSeason(farm.id, "DRAFT");
    const plan = await newPlan(s.id, new Date());
    assert.equal((await call("PATCH", `/farms/${farm.id}`, { village: "Desa Baru" }, users[0].cookie)).status, 200);
    assert.equal(await flag(plan.id), false);
  });

  test("tanpa CostPlan -> 200 dan luas tersimpan", async () => {
    const farm = await newFarm(users[0].id);
    await newSeason(farm.id, "DRAFT");
    const res = await call("PATCH", `/farms/${farm.id}`, { areaHa: 2.5 }, users[0].cookie);
    assert.equal(res.status, 200);
    assert.equal(Number((await res.json()).areaHa), 2.5);
  });

  test("lahan milik orang lain -> 404, CostPlan-nya tidak tersentuh; lahan lain milik sendiri tidak ikut", async () => {
    const milikB = await newFarm(users[1].id);
    const sB = await newSeason(milikB.id, "PEMBIAYAAN");
    const planB = await newPlan(sB.id, new Date());
    const milikA2 = await newFarm(users[0].id);
    const sA2 = await newSeason(milikA2.id, "PEMBIAYAAN");
    const planA2 = await newPlan(sA2.id, new Date());

    assert.equal((await call("PATCH", `/farms/${milikB.id}`, { areaHa: 3 }, users[0].cookie)).status, 404);
    assert.equal(await flag(planB.id), false);
    const row = await prisma.farm.findUnique({ where: { id: milikB.id } });
    assert.equal(Number(row.areaHa), 1.5);

    // mengubah luas lahan sendiri tidak menyentuh Season lahan lain
    const sendiri = await newFarm(users[0].id);
    assert.equal((await call("PATCH", `/farms/${sendiri.id}`, { areaHa: 3 }, users[0].cookie)).status, 200);
    assert.equal(await flag(planA2.id), false);
    assert.equal(await flag(planB.id), false);
  });
});
