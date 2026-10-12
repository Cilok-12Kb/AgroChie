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

describe("Hitung ulang rencana biaya (butuh database uji, engine di-stub)", { skip }, () => {
  let server, base, prisma, realFetch, engineCalls, lastEngineBody, engineOut;
  const tag = String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
  const users = {};
  const farmIds = [];
  const OUT1 = { total_jt: { low: 8, mid: 10, high: 12 }, weekly: [1, 2, 3], models: { season: "ms", weekly: "mw" } };
  const OUT2 = { total_jt: { low: 9.5, mid: 12.25, high: 15 }, weekly: [2, 3, 4], models: { season: "ms", weekly: "mw" } };
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
    const phone = `0896${digit}${tag}`;
    const res = await api("POST", "/auth/register", null, { name: "Uji Ulang " + key, phone, password: "rahasia123" });
    const b = await res.json();
    users[key] = { id: b.id, phone, cookie: (res.headers.getSetCookie()[0] ?? "").split(";")[0] };
  };
  const mkSeason = async () => {
    const farm = await (await api("POST", "/farms", users.a.cookie, { name: "F", ...FARM })).json();
    farmIds.push(farm.id);
    return (await api("POST", `/farms/${farm.id}/seasons`, users.a.cookie, { crop: "CABAI" })).json();
  };
  const started = async () => {
    const s = await mkSeason();
    engineOut = OUT1;
    assert.equal((await api("POST", `/seasons/${s.id}/start-financing`, users.a.cookie, { ...BODY, capitalJt: 11 })).status, 201);
    return s;
  };
  const recalc = (id, body, cookie = users.a.cookie) => api("POST", `/seasons/${id}/recalc-cost`, cookie, body);

  before(async () => {
    assertTestDatabase();
    const { app } = await import("../src/app.js");
    ({ prisma } = await import("../src/config/prisma.js"));
    const { env } = await import("../src/config/env.js");
    await new Promise((r) => (server = app.listen(0, r)));
    base = `http://127.0.0.1:${server.address().port}/api`;
    realFetch = globalThis.fetch;
    engineCalls = 0;
    engineOut = OUT1;
    globalThis.fetch = async (url, opts) => {
      if (String(url).startsWith(env.engineUrl)) {
        engineCalls++;
        lastEngineBody = JSON.parse(opts.body);
        return new Response(JSON.stringify(engineOut), { status: 200, headers: { "content-type": "application/json" } });
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
    assert.equal((await recalc("x", {}, null)).status, 401);
  });

  test("hitung ulang: kind HITUNG_ULANG, bendera lama mati, selisih Decimal benar, AWAL utuh", async () => {
    const s = await started();
    await prisma.costPlan.updateMany({ where: { seasonId: s.id }, data: { needsRecalc: true } });
    engineOut = OUT2;
    const res = await recalc(s.id, {});
    assert.equal(res.status, 200);
    const b = await res.json();
    assert.equal(b.plan.kind, "HITUNG_ULANG");
    assert.equal(b.plan.needsRecalc, false);
    assert.equal(b.selisih.totalJt, "2.25");
    assert.equal(b.selisih.p10Jt, "1.5");
    assert.equal(b.selisih.p50Jt, "2.25");
    assert.equal(b.selisih.p90Jt, "3");
    assert.equal(b.selisih.shortfallJt, "1.25"); // 12.25-11; kekurangan AWAL = 0
    const plans = await prisma.costPlan.findMany({ where: { seasonId: s.id }, orderBy: { createdAt: "asc" } });
    assert.equal(plans.length, 2);
    assert.equal(plans[0].kind, "AWAL");
    assert.equal(plans[0].needsRecalc, false);
    assert.equal(plans[1].kind, "HITUNG_ULANG");
    assert.equal(plans[1].input.bulan_tanam, 9);
  });

  test("luas Season baru dipakai, bukan luas input lama", async () => {
    const s = await started();
    assert.equal((await api("PATCH", `/seasons/${s.id}`, users.a.cookie, { areaHa: 2 })).status, 200);
    engineOut = OUT2;
    assert.equal((await recalc(s.id, { indices: { fertIndex: 110 } })).status, 200);
    assert.equal(lastEngineBody.luas_ha, 2);
    assert.equal(lastEngineBody.indeks_harga_pupuk, 110);
    assert.equal(lastEngineBody.indeks_upah, 103); // sisa masukan lama dipertahankan
    const plans = await prisma.costPlan.findMany({ where: { seasonId: s.id }, orderBy: { createdAt: "asc" } });
    assert.equal(plans[0].needsRecalc, false);
    assert.equal(plans[1].input.luas_ha, 2);
  });

  test("tanpa kind AWAL: selisih null", async () => {
    const s = await started();
    await prisma.costPlan.updateMany({ where: { seasonId: s.id }, data: { kind: "LAIN" } });
    engineOut = OUT2;
    const b = await (await recalc(s.id, {})).json();
    assert.equal(b.selisih, null);
  });

  test("DRAFT dan SELESAI -> 409, engine tidak dipanggil", async () => {
    const s = await mkSeason();
    const before = engineCalls;
    assert.equal((await recalc(s.id, BODY)).status, 409);
    await prisma.season.update({ where: { id: s.id }, data: { status: "SELESAI" } });
    assert.equal((await recalc(s.id, BODY)).status, 409);
    assert.equal(engineCalls, before);
  });

  test("tanpa CostPlan dan body tidak lengkap -> 409; body lengkap diterima", async () => {
    const s = await mkSeason();
    await prisma.season.update({ where: { id: s.id }, data: { status: "PEMBIAYAAN" } });
    const before = engineCalls;
    assert.equal((await recalc(s.id, {})).status, 409);
    assert.equal(engineCalls, before);
    engineOut = OUT1;
    assert.equal((await recalc(s.id, BODY)).status, 200);
    assert.equal(lastEngineBody.luas_ha, 1);
  });

  test("kunci tak dikenal -> 400", async () => {
    const s = await started();
    const before = engineCalls;
    assert.equal((await recalc(s.id, { luas: 3 })).status, 400);
    assert.equal(engineCalls, before);
  });

  test("milik orang lain -> 404, engine tidak dipanggil", async () => {
    const s = await started();
    const before = engineCalls;
    assert.equal((await recalc(s.id, {}, users.b.cookie)).status, 404);
    assert.equal(engineCalls, before);
  });
});

