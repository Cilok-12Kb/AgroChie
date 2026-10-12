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

describe("Buat dan baca musim (butuh database uji)", { skip }, () => {
  let server, base, prisma;
  const tag = String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
  const users = {};
  const farmIds = [];

  const register = async (key, digit) => {
    const phone = `0896${digit}${tag}`;
    const res = await fetch(base + "/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Uji Musim " + key, phone, password: "rahasia123" }),
    });
    const body = await res.json();
    users[key] = { id: body.id, phone, cookie: (res.headers.getSetCookie()[0] ?? "").split(";")[0] };
  };
  const api = (method, path, cookie, body) =>
    fetch(base + path, {
      method,
      headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const mkFarm = async (cookie, data) => {
    const f = await (await api("POST", "/farms", cookie, data)).json();
    farmIds.push(f.id);
    return f;
  };

  before(async () => {
    assertTestDatabase();
    const { app } = await import("../src/app.js");
    ({ prisma } = await import("../src/config/prisma.js"));
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

  test("tanpa sesi -> 401", async () => {
    assert.equal((await api("POST", "/farms/x/seasons", null, { crop: "CABAI" })).status, 401);
    assert.equal((await api("GET", "/farms/x/seasons", null)).status, 401);
    assert.equal((await api("GET", "/seasons/x", null)).status, 401);
  });

  test("default Farm disalin; DRAFT; tanpa angka prediksi; tidak berubah setelah Farm diedit", async () => {
    const farm = await mkFarm(users.a.cookie, { name: "L1", areaHa: 2.5, capitalJt: 12.5, sellPricePerKg: 30000, profitTargetJt: 5 });
    const res = await api("POST", `/farms/${farm.id}/seasons`, users.a.cookie, { crop: "CABAI" });
    assert.equal(res.status, 201);
    const s = await res.json();
    assert.equal(s.status, "DRAFT");
    assert.equal(s.crop, "CABAI");
    assert.equal(s.areaHa, "2.5");
    assert.equal(s.capitalJt, "12.5");
    assert.equal(s.sellPricePerKg, "30000");
    assert.equal(s.profitTargetJt, "5");
    assert.equal("costPlans" in s, false);

    assert.equal((await api("PATCH", `/farms/${farm.id}`, users.a.cookie, { areaHa: 4, capitalJt: 99 })).status, 200);
    const again = await (await api("GET", `/seasons/${s.id}`, users.a.cookie)).json();
    assert.equal(again.areaHa, "2.5");
    assert.equal(again.capitalJt, "12.5");
  });

  test("null tetap null", async () => {
    const farm = await mkFarm(users.a.cookie, { name: "L2", areaHa: 1 });
    const s = await (await api("POST", `/farms/${farm.id}/seasons`, users.a.cookie, { crop: "TOMAT" })).json();
    assert.equal(s.capitalJt, null);
    assert.equal(s.sellPricePerKg, null);
    assert.equal(s.profitTargetJt, null);
    assert.equal(s.areaHa, "1");
  });

  test("musim kedua 409; setelah SELESAI boleh lagi; daftar memuat keduanya", async () => {
    const farm = await mkFarm(users.a.cookie, { name: "L3", areaHa: 1 });
    const r1 = await api("POST", `/farms/${farm.id}/seasons`, users.a.cookie, { crop: "BAWANG" });
    assert.equal(r1.status, 201);
    const s1 = await r1.json();
    assert.equal((await api("POST", `/farms/${farm.id}/seasons`, users.a.cookie, { crop: "CABAI" })).status, 409);
    await prisma.season.update({ where: { id: s1.id }, data: { status: "SELESAI" } });
    assert.equal((await api("POST", `/farms/${farm.id}/seasons`, users.a.cookie, { crop: "CABAI" })).status, 201);
    const list = await (await api("GET", `/farms/${farm.id}/seasons`, users.a.cookie)).json();
    assert.equal(list.length, 2);
  });

  test("body tidak valid -> 400", async () => {
    const farm = await mkFarm(users.a.cookie, { name: "L4", areaHa: 1 });
    assert.equal((await api("POST", `/farms/${farm.id}/seasons`, users.a.cookie, { crop: "JAGUNG" })).status, 400);
    assert.equal((await api("POST", `/farms/${farm.id}/seasons`, users.a.cookie, { crop: "CABAI", areaHa: 1 })).status, 400);
  });

  test("milik orang lain -> 404 (POST, GET daftar, GET detail)", async () => {
    const farm = await mkFarm(users.a.cookie, { name: "L5", areaHa: 1 });
    const s = await (await api("POST", `/farms/${farm.id}/seasons`, users.a.cookie, { crop: "CABAI" })).json();
    assert.equal((await api("POST", `/farms/${farm.id}/seasons`, users.b.cookie, { crop: "CABAI" })).status, 404);
    assert.equal((await api("GET", `/farms/${farm.id}/seasons`, users.b.cookie)).status, 404);
    assert.equal((await api("GET", `/seasons/${s.id}`, users.b.cookie)).status, 404);
    assert.equal(await prisma.season.count({ where: { farmId: farm.id } }), 1);
  });

  // ---- 18.4: PATCH Season ----
  const mkSeason = async (cookie, farmData, crop = "CABAI") => {
    const farm = await mkFarm(cookie, farmData);
    const s = await (await api("POST", `/farms/${farm.id}/seasons`, cookie, { crop })).json();
    return { farm, s };
  };
  const mkPlan = (seasonId, createdAt) =>
    prisma.costPlan.create({
      data: { seasonId, createdAt, totalJt: 10, p10Jt: 9, p50Jt: 10, p90Jt: 11, weeklyJt: [], modelVersion: "uji" },
    });
  const flags = async (seasonId) =>
    (await prisma.costPlan.findMany({ where: { seasonId }, orderBy: { createdAt: "asc" } })).map((p) => p.needsRecalc);

  test("patch: tanpa sesi 401; milik orang lain 404 dan data tidak berubah", async () => {
    const { s } = await mkSeason(users.a.cookie, { name: "P1", areaHa: 1, capitalJt: 5 });
    assert.equal((await api("PATCH", `/seasons/${s.id}`, null, { capitalJt: 1 })).status, 401);
    assert.equal((await api("PATCH", `/seasons/${s.id}`, users.b.cookie, { capitalJt: 1 })).status, 404);
    assert.equal((await prisma.season.findUnique({ where: { id: s.id } })).capitalJt.toString(), "5");
  });

  test("patch parsial tidak mengubah kolom lain; null mengosongkan; body buruk 400", async () => {
    const { s } = await mkSeason(users.a.cookie, { name: "P2", areaHa: 2, capitalJt: 5, sellPricePerKg: 100, profitTargetJt: 3 });
    const res = await api("PATCH", `/seasons/${s.id}`, users.a.cookie, { capitalJt: 8.5 });
    assert.equal(res.status, 200);
    const b = await res.json();
    assert.equal(b.capitalJt, "8.5");
    assert.equal(b.areaHa, "2");
    assert.equal(b.sellPricePerKg, "100");
    assert.equal(b.profitTargetJt, "3");
    assert.equal(b.crop, "CABAI");
    assert.equal(b.status, "DRAFT");
    const n = await (await api("PATCH", `/seasons/${s.id}`, users.a.cookie, { profitTargetJt: null })).json();
    assert.equal(n.profitTargetJt, null);
    assert.equal(n.capitalJt, "8.5");
    assert.equal("costPlans" in n, false);
    assert.equal((await api("PATCH", `/seasons/${s.id}`, users.a.cookie, { status: "TANAM" })).status, 400);
    assert.equal((await api("PATCH", `/seasons/${s.id}`, users.a.cookie, {})).status, 400);
  });

  test("hook: crop dan areaHa menyalakan needsRecalc hanya pada CostPlan terbaru", async () => {
    const { s } = await mkSeason(users.a.cookie, { name: "P3", areaHa: 1 });
    await mkPlan(s.id, new Date("2026-01-01T00:00:00Z"));
    await mkPlan(s.id, new Date("2026-02-01T00:00:00Z"));
    assert.equal((await api("PATCH", `/seasons/${s.id}`, users.a.cookie, { crop: "TOMAT" })).status, 200);
    assert.deepEqual(await flags(s.id), [false, true]);
    await prisma.costPlan.updateMany({ where: { seasonId: s.id }, data: { needsRecalc: false } });
    assert.equal((await api("PATCH", `/seasons/${s.id}`, users.a.cookie, { areaHa: 2 })).status, 200);
    assert.deepEqual(await flags(s.id), [false, true]);
  });

  test("hook: tidak menyala bila nilai sama atau hanya rupiah berubah; tanpa CostPlan aman", async () => {
    const { s } = await mkSeason(users.a.cookie, { name: "P4", areaHa: 1.5 });
    assert.equal((await api("PATCH", `/seasons/${s.id}`, users.a.cookie, { crop: "CABAI", areaHa: "1.50" })).status, 200);
    await mkPlan(s.id, new Date());
    assert.equal((await api("PATCH", `/seasons/${s.id}`, users.a.cookie, { crop: "CABAI", areaHa: "1.50" })).status, 200);
    assert.equal((await api("PATCH", `/seasons/${s.id}`, users.a.cookie, { capitalJt: 7, sellPricePerKg: 1, profitTargetJt: 2 })).status, 200);
    assert.deepEqual(await flags(s.id), [false]);
  });

  test("crop 409 setelah TANAM/PANEN tetapi boleh pada PEMBIAYAAN; kolom lain tetap boleh saat TANAM", async () => {
    const { s } = await mkSeason(users.a.cookie, { name: "P5", areaHa: 1 });
    await prisma.season.update({ where: { id: s.id }, data: { status: "PEMBIAYAAN" } });
    assert.equal((await api("PATCH", `/seasons/${s.id}`, users.a.cookie, { crop: "BAWANG" })).status, 200);
    await prisma.season.update({ where: { id: s.id }, data: { status: "TANAM" } });
    assert.equal((await api("PATCH", `/seasons/${s.id}`, users.a.cookie, { crop: "TOMAT" })).status, 409);
    assert.equal((await prisma.season.findUnique({ where: { id: s.id } })).crop, "BAWANG");
    assert.equal((await api("PATCH", `/seasons/${s.id}`, users.a.cookie, { capitalJt: 4 })).status, 200);
    await prisma.season.update({ where: { id: s.id }, data: { status: "PANEN" } });
    assert.equal((await api("PATCH", `/seasons/${s.id}`, users.a.cookie, { crop: "TOMAT" })).status, 409);
  });

  test("semua perubahan 409 setelah SELESAI", async () => {
    const { s } = await mkSeason(users.a.cookie, { name: "P6", areaHa: 1, capitalJt: 5 });
    await prisma.season.update({ where: { id: s.id }, data: { status: "SELESAI" } });
    for (const b of [{ crop: "TOMAT" }, { areaHa: 2 }, { capitalJt: 1 }, { sellPricePerKg: 1 }, { profitTargetJt: null }]) {
      assert.equal((await api("PATCH", `/seasons/${s.id}`, users.a.cookie, b)).status, 409, JSON.stringify(b));
    }
    assert.equal((await prisma.season.findUnique({ where: { id: s.id } })).capitalJt.toString(), "5");
  });});

