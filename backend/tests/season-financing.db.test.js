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
process.env.ENGINE_INTERNAL_KEY = "kunci-uji"; // sebelum env.js dimuat; engine selalu di-stub

describe("Mulai/hentikan pembiayaan (butuh database uji, engine di-stub)", { skip }, () => {
  let server, base, prisma, realFetch, engineCalls;
  const tag = String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
  const users = {};
  const farmIds = [];
  const ENGINE_OUT = { total_jt: { low: 8, mid: 10, high: 12 }, weekly: [1, 2, 3], models: { season: "ms", weekly: "mw" } };
  const BODY = { weather: { rainAvgMm: 60, heavyRainWks: 1, tempMaxAvg: 30 }, indices: { fertIndex: 105, wageIndex: 103, pestIndex: 104 }, startMonth: 9 };
  const FARM = { areaHa: 1, soilType: "Lempung", waterSource: "Irigasi teknis", province: "Jawa Tengah", ph: 6, phMeasuredOn: "2026-03-01",
    nitrogen: "SEDANG", phosphorus: "SEDANG", potassium: "TINGGI" };

  const api = (method, path, cookie, body) =>
    fetch(base + path, {
      method,
      headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const register = async (key, digit) => {
    const phone = `0895${digit}${tag}`;
    const res = await api("POST", "/auth/register", null, { name: "Uji Biaya " + key, phone, password: "rahasia123" });
    const b = await res.json();
    users[key] = { id: b.id, phone, cookie: (res.headers.getSetCookie()[0] ?? "").split(";")[0] };
  };
  const mkSeason = async (farmExtra = {}) => {
    const farm = await (await api("POST", "/farms", users.a.cookie, { name: "F", ...FARM, ...farmExtra })).json();
    farmIds.push(farm.id);
    return (await api("POST", `/farms/${farm.id}/seasons`, users.a.cookie, { crop: "CABAI" })).json();
  };
  const start = (id, extra = {}, cookie = users.a.cookie) => api("POST", `/seasons/${id}/start-financing`, cookie, { ...BODY, ...extra });
  const stop = (id, cookie = users.a.cookie) => api("POST", `/seasons/${id}/stop-financing`, cookie);

  before(async () => {
    assertTestDatabase();
    const { app } = await import("../src/app.js");
    ({ prisma } = await import("../src/config/prisma.js"));
    const { env } = await import("../src/config/env.js");
    await new Promise((r) => (server = app.listen(0, r)));
    base = `http://127.0.0.1:${server.address().port}/api`;
    // Stub hanya panggilan ke engine; panggilan ke server uji tetap sungguhan.
    realFetch = globalThis.fetch;
    engineCalls = 0;
    globalThis.fetch = async (url, opts) => {
      if (String(url).startsWith(env.engineUrl)) {
        engineCalls++;
        return new Response(JSON.stringify(ENGINE_OUT), { status: 200, headers: { "content-type": "application/json" } });
      }
      return realFetch(url, opts);
    };
    await register("a", "1");
    await register("b", "2");
  });

  after(async () => {
    if (realFetch) globalThis.fetch = realFetch;
    if (prisma) {
      if (farmIds.length) {
        const seasons = await prisma.season.findMany({ where: { farmId: { in: farmIds } }, select: { id: true } });
        const ids = seasons.map((s) => s.id);
        if (ids.length) {
          await prisma.predictionLog.deleteMany({ where: { seasonId: { in: ids } } });
          await prisma.costPlan.deleteMany({ where: { seasonId: { in: ids } } });
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
    assert.equal((await start("x", {}, null)).status, 401);
    assert.equal((await stop("x", null)).status, 401);
  });

  test("modal tidak dikirim: pakai default Season; input tersimpan; breakEven null; Decimal", async () => {
    const s = await mkSeason({ capitalJt: 12.5 });
    const res = await start(s.id);
    assert.equal(res.status, 201);
    const row = await prisma.season.findUnique({ where: { id: s.id } });
    assert.equal(row.status, "PEMBIAYAAN");
    assert.ok(row.financingStartedAt);
    assert.equal(row.capitalJt.toString(), "12.5");
    const plan = await prisma.costPlan.findFirst({ where: { seasonId: s.id } });
    assert.equal(plan.capitalJt.toString(), "12.5");
    assert.equal(plan.shortfallJt.toString(), "0");
    assert.equal(plan.totalJt.toString(), "10");
    assert.equal(plan.breakEvenPerKg, null);
    assert.equal(plan.kind, "AWAL");
    assert.equal(plan.input.komoditas, "cabai");
    assert.equal(plan.input.luas_ha, 1);
    assert.equal(plan.input.bulan_tanam, 9);
  });

  test("modal dikirim menimpa default Season; kekurangan dihitung Decimal", async () => {
    const s = await mkSeason({ capitalJt: 12.5 });
    assert.equal((await start(s.id, { capitalJt: "4.25" })).status, 201);
    const row = await prisma.season.findUnique({ where: { id: s.id } });
    assert.equal(row.capitalJt.toString(), "4.25");
    const plan = await prisma.costPlan.findFirst({ where: { seasonId: s.id } });
    assert.equal(plan.shortfallJt.toString(), "5.75");
  });

  test("modal kosong (Season null) diterima: tidak 400, tetap null", async () => {
    const s = await mkSeason();
    assert.equal((await start(s.id)).status, 201);
    const row = await prisma.season.findUnique({ where: { id: s.id } });
    assert.equal(row.capitalJt, null);
    const plan = await prisma.costPlan.findFirst({ where: { seasonId: s.id } });
    assert.equal(plan.capitalJt, null);
  });

  test("capitalJt tidak valid -> 400 dan status tetap DRAFT", async () => {
    const s = await mkSeason();
    assert.equal((await start(s.id, { capitalJt: -3 })).status, 400);
    assert.equal((await prisma.season.findUnique({ where: { id: s.id } })).status, "DRAFT");
  });

  test("mulai dua kali -> 409; hanya satu CostPlan", async () => {
    const s = await mkSeason();
    assert.equal((await start(s.id)).status, 201);
    assert.equal((await start(s.id)).status, 409);
    assert.equal(await prisma.costPlan.count({ where: { seasonId: s.id } }), 1);
  });

  test("hentikan: DRAFT, financingStoppedAt terisi, CostPlan tetap ada; mulai lagi mengosongkannya", async () => {
    const s = await mkSeason();
    await start(s.id);
    const res = await stop(s.id);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, "DRAFT");
    assert.ok(body.financingStoppedAt);
    assert.equal(await prisma.costPlan.count({ where: { seasonId: s.id } }), 1);
    assert.equal((await start(s.id)).status, 201);
    const row = await prisma.season.findUnique({ where: { id: s.id } });
    assert.equal(row.status, "PEMBIAYAAN");
    assert.equal(row.financingStoppedAt, null);
    assert.equal(await prisma.costPlan.count({ where: { seasonId: s.id } }), 2);
  });

  test("stop dari DRAFT, TANAM, atau SELESAI -> 409", async () => {
    const s = await mkSeason();
    assert.equal((await stop(s.id)).status, 409);
    for (const status of ["TANAM", "SELESAI"]) {
      await prisma.season.update({ where: { id: s.id }, data: { status } });
      assert.equal((await stop(s.id)).status, 409, status);
    }
  });

  test("milik orang lain -> 404 dan engine tidak dipanggil", async () => {
    const s = await mkSeason();
    const before = engineCalls;
    assert.equal((await start(s.id, {}, users.b.cookie)).status, 404);
    assert.equal(engineCalls, before);
    await start(s.id);
    assert.equal((await stop(s.id, users.b.cookie)).status, 404);
    assert.equal((await prisma.season.findUnique({ where: { id: s.id } })).status, "PEMBIAYAAN");
  });
});
