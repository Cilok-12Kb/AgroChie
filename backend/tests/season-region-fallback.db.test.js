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

describe("Penanda regionFallback di respons prediksi (butuh database uji, engine di-stub)", { skip }, () => {
  let server, base, prisma, realFetch, user;
  const tag = String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
  const farmIds = [];
  const ENGINE_OUT = { total_jt: { low: 8, mid: 10, high: 12 }, weekly: [1, 2, 3], models: { season: "ms", weekly: "mw" } };
  const BODY = { weather: { rainAvgMm: 60, heavyRainWks: 1, tempMaxAvg: 30 }, indices: { fertIndex: 105, wageIndex: 103, pestIndex: 104 }, startMonth: 9 };
  const FARM = { name: "F", areaHa: 1, soilType: "Lempung", waterSource: "Irigasi teknis", ph: 6, phMeasuredOn: "2026-03-01",
    nitrogen: "SEDANG", phosphorus: "SEDANG", potassium: "TINGGI" };

  const api = (method, path, body) =>
    fetch(base + path, {
      method,
      headers: { "content-type": "application/json", ...(user?.cookie ? { cookie: user.cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const mkSeason = async (country, province) => {
    const farm = await (await api("POST", "/farms", { ...FARM, country, province })).json();
    farmIds.push(farm.id);
    return (await api("POST", `/farms/${farm.id}/seasons`, { crop: "CABAI" })).json();
  };

  before(async () => {
    assertTestDatabase();
    const { app } = await import("../src/app.js");
    ({ prisma } = await import("../src/config/prisma.js"));
    const { env } = await import("../src/config/env.js");
    await new Promise((r) => (server = app.listen(0, r)));
    base = `http://127.0.0.1:${server.address().port}/api`;
    realFetch = globalThis.fetch;
    // Stub hanya panggilan ke engine; panggilan ke server uji tetap sungguhan.
    globalThis.fetch = async (url, opts) => {
      if (String(url).startsWith(env.engineUrl)) {
        return new Response(JSON.stringify(ENGINE_OUT), { status: 200, headers: { "content-type": "application/json" } });
      }
      return realFetch(url, opts);
    };
    const phone = `0894${tag}1`;
    const res = await api("POST", "/auth/register", { name: "Uji Wilayah", phone, password: "rahasia123" });
    const b = await res.json();
    user = { id: b.id, phone, cookie: (res.headers.getSetCookie()[0] ?? "").split(";")[0] };
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
      if (user) await prisma.user.deleteMany({ where: { phone: user.phone } });
      await prisma.$disconnect();
    }
    server?.close();
  });

  const CASES = [
    ["ID", "Jawa Tengah", false],
    ["ID", "Bali", true],
    ["MY", "Selangor", true],
  ];
  for (const [country, province, expected] of CASES) {
    test(`${country} + ${province}: regionFallback=${expected} di start-financing, predict-cost, recalc-cost; tidak tersimpan`, async () => {
      const s = await mkSeason(country, province);

      const start = await api("POST", `/seasons/${s.id}/start-financing`, BODY);
      assert.equal(start.status, 201);
      assert.equal((await start.json()).regionFallback, expected, "start-financing");

      const pred = await api("POST", `/seasons/${s.id}/predict-cost`, BODY);
      assert.equal(pred.status, 200);
      assert.equal((await pred.json()).regionFallback, expected, "predict-cost");

      const re = await api("POST", `/seasons/${s.id}/recalc-cost`, BODY);
      assert.equal(re.status, 200);
      assert.equal((await re.json()).regionFallback, expected, "recalc-cost");

      // Penanda hanya di respons: tidak ada di PredictionLog maupun CostPlan.
      const logs = await prisma.predictionLog.findMany({ where: { seasonId: s.id } });
      const plans = await prisma.costPlan.findMany({ where: { seasonId: s.id } });
      assert.ok(logs.length >= 3 && plans.length >= 2);
      assert.doesNotMatch(JSON.stringify(logs), /regionFallback/);
      assert.doesNotMatch(JSON.stringify(plans), /regionFallback/);
    });
  }
});
