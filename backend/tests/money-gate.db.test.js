import "dotenv/config";
import { createHash } from "node:crypto";
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
  let server, base, prisma, realFetch, engineCalls = 0;
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
        engineCalls++;
        return new Response(JSON.stringify(ENGINE_OUT), { status: 200, headers: { "content-type": "application/json" } });
      }
      return realFetch(url, opts);
    };
    const phone = `08971${tag}`;
    const res = await api("POST", "/auth/register", null, { name: "Uji Gerbang", phone, password: "rahasia123" });
    const b = await res.json();
    users.a = { id: b.id, phone, cookie: (res.headers.getSetCookie()[0] ?? "").split(";")[0] };
    const phoneB = `08972${tag}`;
    const resB = await api("POST", "/auth/register", null, { name: "Uji Gerbang B", phone: phoneB, password: "rahasia123" });
    const bb = await resB.json();
    users.b = { id: bb.id, phone: phoneB, cookie: (resB.headers.getSetCookie()[0] ?? "").split(";")[0] };
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
      for (const u of Object.values(users)) await prisma.user.deleteMany({ where: { phone: u.phone } });
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

  // [REVISI] 18.11b: pelengkap tes kebocoran (foto, start/recalc, close, kolom input).
  const PRED_KEYS = ["p10Jt", "p50Jt", "p90Jt", "shortfallJt", "weeklyJt"];
  const INPUT_KEY = /"input"\s*:/;
  const sha = (n) => createHash("sha256").update(`${tag}-gate-${n}`).digest("hex");

  test("DRAFT dengan riwayat CostPlan: rute foto tidak memuat angka prediksi atau kolom input", async () => {
    const s = await mkSeason();
    assert.equal((await start(s.id)).status, 201);
    await stop(s.id);
    assert.equal(await plans(s.id), 1);
    const photo = { kind: "PROGRES", objectKey: `gate/${tag}/a.jpg`, sha256: sha("draft"), takenAt: new Date(Date.now() - 60_000).toISOString() };
    for (const [m, p, b] of [["GET", `/seasons/${s.id}/photos`], ["POST", `/seasons/${s.id}/photos`, photo], ["GET", `/seasons/${s.id}/photos`]]) {
      const res = await api(m, p, cookie(), b);
      const txt = await res.text();
      assert.ok(res.status < 500, `${m} ${p} -> ${res.status}`);
      assert.doesNotMatch(txt, LEAK, `${m} ${p}`);
      assert.doesNotMatch(txt, INPUT_KEY, `${m} ${p}`);
    }
  });

  test("DRAFT: rute Season/ringkasan tidak mengeluarkan kolom input", async () => {
    const s = await mkSeason();
    await start(s.id);
    await stop(s.id);
    for (const p of [`/seasons/${s.id}`, `/farms/${s.farmId}/seasons`, `/seasons/${s.id}/expenses/summary`]) {
      assert.doesNotMatch(await (await api("GET", p, cookie())).text(), INPUT_KEY, p);
    }
  });

  test("start-financing dan recalc-cost (bukan DRAFT) MEMUAT angka; kolom input tidak keluar", async () => {
    const s = await mkSeason();
    const st = await start(s.id);
    assert.equal(st.status, 201);
    const a = await st.text();
    for (const k of PRED_KEYS) assert.match(a, new RegExp(`"${k}"`), `start-financing tanpa ${k}`);
    assert.doesNotMatch(a, INPUT_KEY, "start-financing mengeluarkan input");

    const rc = await api("POST", `/seasons/${s.id}/recalc-cost`, cookie(), BODY);
    assert.equal(rc.status, 200);
    const b = await rc.text();
    for (const k of PRED_KEYS) assert.match(b, new RegExp(`"${k}"`), `recalc-cost tanpa ${k}`);
    assert.doesNotMatch(b, INPUT_KEY, "recalc-cost mengeluarkan input");
  });

  test("close (PANEN siap tutup, punya riwayat CostPlan): hanya data kenyataan, tanpa kunci prediksi dan input", async () => {
    const s = await mkSeason();
    assert.equal((await start(s.id)).status, 201);
    await prisma.season.update({ where: { id: s.id }, data: { status: "PANEN", plantedOn: new Date(Date.now() - 30 * DAY) } });
    await prisma.harvest.create({ data: { seasonId: s.id, harvestedOn: new Date(Date.now() - DAY), grade: "A", weightKg: "1000", pricePerKg: "20000" } });
    await prisma.harvestSample.create({ data: { seasonId: s.id, sampleKg: "10", sampleM2: "100" } });
    const ph = await api("POST", `/seasons/${s.id}/photos`, cookie(), { kind: "SAMPEL", objectKey: `gate/${tag}/s.jpg`, sha256: sha("close"), takenAt: new Date(Date.now() - 60_000).toISOString() });
    assert.equal(ph.status, 201);
    const res = await api("POST", `/seasons/${s.id}/close`, cookie(), { totalCostJt: "10" });
    assert.equal(res.status, 200);
    const txt = await res.text();
    for (const k of PRED_KEYS) assert.doesNotMatch(txt, new RegExp(`"${k}"`), `close memuat ${k}`);
    assert.doesNotMatch(txt, INPUT_KEY);
    assert.equal(JSON.parse(txt).summary.status, "SELESAI");
  });

  // [REVISI] 18.11c: predict-cost ditolak 409 saat DRAFT.
  const predict = (id, cookieStr = cookie()) => api("POST", `/seasons/${id}/predict-cost`, cookieStr, BODY);
  const logs = (id) => prisma.predictionLog.count({ where: { seasonId: id } });

  test("predict-cost DRAFT: 409, engine tidak dipanggil, tidak ada log, tanpa angka", async () => {
    const s = await mkSeason();
    const calls0 = engineCalls, logs0 = await logs(s.id);
    const res = await predict(s.id);
    assert.equal(res.status, 409);
    const txt = await res.text();
    assert.doesNotMatch(txt, /total_jt|"weekly"|"low"|"mid"|"high"/);
    assert.doesNotMatch(txt, LEAK);
    assert.equal(engineCalls, calls0, "engine tidak boleh dipanggil");
    assert.equal(await logs(s.id), logs0, "predictionLog tidak boleh bertambah");
  });

  test("predict-cost DRAFT dengan riwayat CostPlan (setelah Hentikan): tetap 409", async () => {
    const s = await mkSeason();
    assert.equal((await start(s.id)).status, 201);
    await stop(s.id);
    const calls0 = engineCalls, logs0 = await logs(s.id);
    assert.equal((await predict(s.id)).status, 409);
    assert.equal(engineCalls, calls0);
    assert.equal(await logs(s.id), logs0);
  });

  test("predict-cost PEMBIAYAAN: tetap berfungsi (200, angka, engine dipanggil, satu log bertambah)", async () => {
    const s = await mkSeason();
    assert.equal((await start(s.id)).status, 201);
    const calls0 = engineCalls, logs0 = await logs(s.id);
    const res = await predict(s.id);
    assert.equal(res.status, 200);
    const b = await res.json();
    assert.equal(b.total_jt.mid, 10);
    assert.deepEqual(b.weekly, [1, 2, 3]);
    assert.equal(engineCalls, calls0 + 1);
    assert.equal(await logs(s.id), logs0 + 1);
  });

  test("predict-cost: tanpa sesi 401; milik orang lain 404 (menang atas 409) pada musim DRAFT", async () => {
    const s = await mkSeason(); // DRAFT
    const calls0 = engineCalls;
    assert.equal((await predict(s.id, null)).status, 401);
    assert.equal((await predict(s.id, users.b.cookie)).status, 404);
    assert.equal((await predict("tidak-ada-id")).status, 404);
    assert.equal(engineCalls, calls0);
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
