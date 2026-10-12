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

describe("Gerbang uang di API (butuh database uji, engine di-stub)", { skip }, () => {
  let server, base, prisma, realFetch;
  const tag = String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
  const users = {};
  const farmIds = [];
  const ENGINE_OUT = { total_jt: { low: 8, mid: 10, high: 12 }, weekly: [1, 2, 3], models: { season: "ms", weekly: "mw" } };
  const BODY = { weather: { rainAvgMm: 60, heavyRainWks: 1, tempMaxAvg: 30 }, indices: { fertIndex: 105, wageIndex: 103, pestIndex: 104 }, startMonth: 9 };
  const FARM = { areaHa: 1, soilType: "Lempung", waterSource: "Irigasi teknis", province: "Jawa Tengah", ph: 6, phMeasuredOn: "2026-03-01",
    nitrogen: "SEDANG", phosphorus: "SEDANG", potassium: "TINGGI", capitalJt: 11, sellPricePerKg: 25000, profitTargetJt: 5 };
  const LEAK = /"weeklyJt"|"p10Jt"|"p50Jt"|"p90Jt"|"shortfallJt"|"needsRecalc"|"breakEvenPerKg"|"modelVersion"/;
  const DAY = 86_400_000;

  const api = (method, path, cookie, body) =>
    fetch(base + path, {
      method,
      headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const cookie = () => users.a.cookie;
  const mkSeason = async () => {
    const farm = await (await api("POST", "/farms", cookie(), { name: "F", ...FARM })).json();
    farmIds.push(farm.id);
    const s = await (await api("POST", `/farms/${farm.id}/seasons`, cookie(), { crop: "CABAI" })).json();
    return { ...s, farmId: farm.id };
  };
  const start = (id) => api("POST", `/seasons/${id}/start-financing`, cookie(), BODY);
  const stop = (id) => api("POST", `/seasons/${id}/stop-financing`, cookie());
  const detail = async (id) => (await api("GET", `/seasons/${id}`, cookie())).json();
  const listed = async (s) => (await (await api("GET", `/farms/${s.farmId}/seasons`, cookie())).json()).find((x) => x.id === s.id);
  const plans = (id) => prisma.costPlan.count({ where: { seasonId: id } });
  const hidden = (v) => {
    assert.equal(v.costPlan, null);
    assert.equal("costPlans" in v, false);
  };
  const shown = (v) => {
    assert.ok(v.costPlan, "costPlan harus ada");
    assert.equal(v.costPlan.totalJt, "10");
    assert.equal(v.costPlan.p10Jt, "8");
    assert.equal(v.costPlan.p90Jt, "12");
    assert.deepEqual(v.costPlan.weeklyJt, [1, 2, 3]);
  };
  const own = (v) => [v.capitalJt, v.sellPricePerKg, v.profitTargetJt];

  before(async () => {
    assertTestDatabase();
    const { app } = await import("../src/app.js");
    ({ prisma } = await import("../src/config/prisma.js"));
    const { env } = await import("../src/config/env.js");
    await new Promise((r) => (server = app.listen(0, r)));
    base = `http://127.0.0.1:${server.address().port}/api`;
    realFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      if (String(url).startsWith(env.engineUrl)) {
        return new Response(JSON.stringify(ENGINE_OUT), { status: 200, headers: { "content-type": "application/json" } });
      }
      return realFetch(url, opts);
    };
    const phone = `08971${tag}`;
    const res = await api("POST", "/auth/register", null, { name: "Uji Gerbang", phone, password: "rahasia123" });
    const b = await res.json();
    users.a = { id: b.id, phone, cookie: (res.headers.getSetCookie()[0] ?? "").split(";")[0] };
  });

  after(async () => {
    if (realFetch) globalThis.fetch = realFetch;
    if (prisma) {
      if (farmIds.length) {
        const ids = (await prisma.season.findMany({ where: { farmId: { in: farmIds } }, select: { id: true } })).map((s) => s.id);
        if (ids.length) {
          await prisma.predictionLog.deleteMany({ where: { seasonId: { in: ids } } });
          await prisma.costPlan.deleteMany({ where: { seasonId: { in: ids } } });
          await prisma.expense.deleteMany({ where: { seasonId: { in: ids } } });
        }
        await prisma.season.deleteMany({ where: { farmId: { in: farmIds } } });
        await prisma.farm.deleteMany({ where: { id: { in: farmIds } } });
      }
      if (users.a) await prisma.user.deleteMany({ where: { phone: users.a.phone } });
      await prisma.$disconnect();
    }
    server?.close();
  });

  test("DRAFT tanpa CostPlan: tanpa angka prediksi; modal/harga/target ada", async () => {
    const s = await mkSeason();
    assert.equal(await plans(s.id), 0);
    for (const v of [s, await detail(s.id), await listed(s)]) {
      hidden(v);
      assert.deepEqual(own(v), ["11", "25000", "5"]);
    }
  });

  test("Mulai -> muncul; Hentikan -> hilang walau baris tetap ada; Mulai lagi -> muncul", async () => {
    const s = await mkSeason();
    assert.equal((await start(s.id)).status, 201);
    shown(await detail(s.id));
    shown(await listed(s));

    const stopped = await (await stop(s.id)).json();
    hidden(stopped);
    assert.equal(stopped.status, "DRAFT");
    assert.ok(stopped.financingStoppedAt, "financingStoppedAt tetap tampil");
    hidden(await detail(s.id));
    hidden(await listed(s));
    assert.equal(await plans(s.id), 1, "baris CostPlan tidak dihapus (Q8)");
    assert.equal((await prisma.costPlan.findFirst({ where: { seasonId: s.id } })).totalJt.toString(), "10");

    assert.equal((await start(s.id)).status, 201);
    shown(await detail(s.id));
    shown(await listed(s));
    assert.equal(await plans(s.id), 2);
  });

  test("TANAM dan PANEN: angka tetap tampil; modal/harga/target identik di semua status", async () => {
    const s = await mkSeason();
    const base0 = own(await detail(s.id));
    assert.deepEqual(base0, ["11", "25000", "5"]);
    assert.equal((await start(s.id)).status, 201);
    assert.deepEqual(own(await detail(s.id)), base0);
    for (const status of ["TANAM", "PANEN"]) {
      await prisma.season.update({ where: { id: s.id }, data: { status, plantedOn: new Date(Date.now() - 3 * DAY) } });
      const d = await detail(s.id);
      assert.equal(d.status, status);
      shown(d);
      shown(await listed(s));
      assert.deepEqual(own(d), base0);
    }
  });

  test("tidak ada rute yang membocorkan angka pada musim DRAFT yang punya riwayat CostPlan", async () => {
    const s = await mkSeason();
    assert.equal((await start(s.id)).status, 201);
    await stop(s.id);
    assert.equal(await plans(s.id), 1);
    await prisma.season.update({ where: { id: s.id }, data: { plantedOn: new Date(Date.now() - 10 * DAY) } });
    await prisma.costPlan.updateMany({ where: { seasonId: s.id }, data: { needsRecalc: true } });
    const routes = [
      ["GET", `/seasons/${s.id}`],
      ["GET", `/farms/${s.farmId}/seasons`],
      ["PATCH", `/seasons/${s.id}`, { areaHa: 2 }],
      ["GET", `/seasons/${s.id}/expenses/summary`],
      ["POST", `/seasons/${s.id}/stop-financing`], // 409 pada DRAFT
      ["POST", `/seasons/${s.id}/recalc-cost`, BODY], // 409 pada DRAFT
      ["POST", `/seasons/${s.id}/start-planting`, {}], // 409 pada DRAFT
    ];
    for (const [m, p, b] of routes) {
      const res = await api(m, p, cookie(), b);
      const txt = await res.text();
      assert.doesNotMatch(txt, LEAK, `${m} ${p} membocorkan angka`);
      const j = JSON.parse(txt);
      for (const it of Array.isArray(j) ? j : [j]) if (it.status) hidden(it);
    }
    assert.equal(await plans(s.id), 1, "data CostPlan tidak berubah oleh penyaringan");
  });

  test("ringkasan pengeluaran: rencana muncul saat PEMBIAYAAN, hilang saat DRAFT", async () => {
    const s = await mkSeason();
    assert.equal((await start(s.id)).status, 201);
    await prisma.season.update({ where: { id: s.id }, data: { plantedOn: new Date(Date.now() - 10 * DAY) } });
    const on = await (await api("GET", `/seasons/${s.id}/expenses/summary`, cookie())).json();
    await stop(s.id);
    const off = await (await api("GET", `/seasons/${s.id}/expenses/summary`, cookie())).json();
    assert.notEqual(JSON.stringify(on), JSON.stringify(off));
    assert.doesNotMatch(JSON.stringify(off), /"planJt":"?[0-9]/);
  });
});
