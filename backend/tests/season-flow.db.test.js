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

// [REVISI] 18.12: alur penuh satu musim lewat HTTP, berurutan (tiap test memakai hasil test sebelumnya).
describe("Alur penuh satu musim (butuh database uji, engine di-stub)", { skip }, () => {
  let server, base, prisma, realFetch, todayWib, engineOut, engineCalls, cookie;
  const tag = String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
  const phone = `0899${tag}`;
  const farmIds = [];
  const st = {}; // keadaan bersama antar-langkah

  const WEEKLY = Array(16).fill(0.5);
  const OUT1 = { total_jt: { low: 8, mid: 10, high: 12 }, weekly: WEEKLY, models: { season: "ms", weekly: "mw" } };
  const OUT2 = { total_jt: { low: 9.5, mid: 12.25, high: 15 }, weekly: WEEKLY, models: { season: "ms", weekly: "mw" } };
  const BODY = { weather: { rainAvgMm: 60, heavyRainWks: 1, tempMaxAvg: 30 }, indices: { fertIndex: 105, wageIndex: 103, pestIndex: 104 }, startMonth: 9 };
  const FARM = { name: "Lahan Alur", areaHa: 1, soilType: "Lempung", waterSource: "Irigasi teknis", province: "Jawa Tengah", ph: 6, phMeasuredOn: "2026-03-01",
    nitrogen: "SEDANG", phosphorus: "SEDANG", potassium: "TINGGI", capitalJt: 8, sellPricePerKg: 25000, profitTargetJt: 5 };
  const ago = (d) => new Date(todayWib().getTime() - d * 86_400_000);
  const day = (d) => ago(d).toISOString().slice(0, 10);
  const sha = () => createHash("sha256").update(`alur-${tag}`).digest("hex");
  const j = (res) => res.json();
  const api = (method, path, body) =>
    fetch(base + path, {
      method,
      headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  before(async () => {
    assertTestDatabase();
    const { app } = await import("../src/app.js");
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ todayWib } = await import("../src/validators/season.validator.js"));
    const { env } = await import("../src/config/env.js");
    await new Promise((r) => (server = app.listen(0, r)));
    base = `http://127.0.0.1:${server.address().port}/api`;
    realFetch = globalThis.fetch;
    engineCalls = 0;
    engineOut = OUT1;
    globalThis.fetch = async (url, opts) => {
      if (String(url).startsWith(env.engineUrl)) {
        engineCalls++;
        return new Response(JSON.stringify(engineOut), { status: 200, headers: { "content-type": "application/json" } });
      }
      return realFetch(url, opts);
    };
    const res = await api("POST", "/auth/register", { name: "Uji Alur", phone, password: "rahasia123" });
    cookie = (res.headers.getSetCookie()[0] ?? "").split(";")[0];
  });

  after(async () => {
    if (realFetch) globalThis.fetch = realFetch;
    if (prisma) {
      if (farmIds.length) {
        const ids = (await prisma.season.findMany({ where: { farmId: { in: farmIds } }, select: { id: true } })).map((s) => s.id);
        const where = { seasonId: { in: ids } };
        if (ids.length) {
          for (const m of ["predictionLog", "costPlan", "photo", "harvest", "harvestSample", "expense", "seasonRecord"]) await prisma[m].deleteMany({ where });
        }
        await prisma.season.deleteMany({ where: { farmId: { in: farmIds } } });
        await prisma.farm.deleteMany({ where: { id: { in: farmIds } } });
      }
      await prisma.user.deleteMany({ where: { phone } });
      await prisma.$disconnect();
    }
    server?.close();
  });

  test("1. buat lahan dan musim -> DRAFT, tanpa costPlan, modal/harga/target ada", async () => {
    const fr = await api("POST", "/farms", FARM);
    assert.equal(fr.status, 201);
    st.farmId = (await j(fr)).id;
    farmIds.push(st.farmId);
    const r = await api("POST", `/farms/${st.farmId}/seasons`, { crop: "CABAI" });
    assert.equal(r.status, 201);
    const s = await j(r);
    st.id = s.id;
    assert.equal(s.status, "DRAFT");
    assert.equal(s.costPlan, null);
    assert.equal(s.capitalJt, "8");
    assert.equal(s.sellPricePerKg, "25000");
    assert.equal(s.profitTargetJt, "5");
  });

  test("2. predict-cost saat DRAFT -> 409 dan engine tidak dipanggil", async () => {
    const before = engineCalls;
    const r = await api("POST", `/seasons/${st.id}/predict-cost`, BODY);
    assert.equal(r.status, 409);
    assert.equal(engineCalls, before);
  });

  test("3. start-financing -> PEMBIAYAAN, costPlan muncul, `input` tidak keluar", async () => {
    const r = await api("POST", `/seasons/${st.id}/start-financing`, BODY);
    assert.equal(r.status, 201);
    const b = await j(r);
    assert.equal(b.plan.kind, "AWAL");
    assert.equal(b.plan.totalJt, "10");
    assert.equal(b.plan.shortfallJt, "2");
    assert.equal("input" in b.plan, false);
    assert.equal("seasonId" in b.plan, false);
    const s = await j(await api("GET", `/seasons/${st.id}`));
    assert.equal(s.status, "PEMBIAYAAN");
    assert.equal(s.costPlan.kind, "AWAL");
    assert.equal(s.costPlan.totalJt, "10");
    assert.equal("input" in s.costPlan, false);
  });

  test("4. start-planting -> TANAM, minggu berjalan dan estimasi panen benar", async () => {
    const r = await api("POST", `/seasons/${st.id}/start-planting`, { plantedOn: day(14) });
    assert.equal(r.status, 200);
    const b = await j(r);
    assert.equal(b.season.status, "TANAM");
    assert.equal(b.currentWeek, 3);
    assert.equal(b.harvestEstimate.slice(0, 10), day(14 - 112));
    assert.equal(b.season.plantedOn.slice(0, 10), day(14));
  });

  test("5. pengeluaran: simulasi diabaikan, rencana vs kenyataan benar", async () => {
    const add = (category, amountJt, extra = {}) => api("POST", `/seasons/${st.id}/expenses`, { category, amountJt, spentOn: day(5), ...extra });
    assert.equal((await add("BENIH", "0.3")).status, 201);
    assert.equal((await add("PUPUK", "1")).status, 201);
    assert.equal((await add("TENAGA_KERJA", "0.7")).status, 201);
    // `simulated` tidak diterima lewat API (strictObject); catatan simulasi disisipkan langsung ke DB.
    assert.equal((await add("OBAT", "5", { simulated: true })).status, 400);
    await prisma.expense.create({ data: { seasonId: st.id, category: "OBAT", amountJt: "5", spentOn: ago(4), simulated: true } });
    const list = await j(await api("GET", `/seasons/${st.id}/expenses`));
    assert.equal(list.length, 4);
    st.expenseId = list.find((e) => e.category === "BENIH").id;
    const sm = await j(await api("GET", `/seasons/${st.id}/expenses/summary`));
    assert.equal(sm.currentWeek, 3);
    const cat = Object.fromEntries(sm.categories.map((c) => [c.category, c]));
    assert.equal(cat.OBAT.actualJt, "0", "simulasi tidak dihitung");
    assert.equal(cat.BENIH.planJt, "0.2745");
    assert.equal(cat.BENIH.actualJt, "0.3");
    assert.equal(cat.BENIH.warning, false); // 0.3 <= 1.15 x 0.2745
    assert.equal(cat.PUPUK.planJt, "0.4635");
    assert.equal(cat.PUPUK.actualJt, "1");
    assert.equal(cat.PUPUK.warning, true);
    assert.equal(sm.total.planJt, "1.5");
    assert.equal(sm.total.actualJt, "2");
    assert.equal(sm.total.warning, true);
  });

  test("6. panen (dua kali) -> PANEN; sampel; foto SAMPEL", async () => {
    const hv = (kg, pricePerKg, d) => api("POST", `/seasons/${st.id}/harvests`, { kg, pricePerKg, harvestedOn: day(d), grade: "A" });
    assert.equal((await api("PUT", `/seasons/${st.id}/sample`, { sampleKg: 10, sampleM2: 100 })).status, 409, "sampel sebelum panen");
    assert.equal((await hv("600", "20000", 3)).status, 201);
    assert.equal((await j(await api("GET", `/seasons/${st.id}`))).status, "PANEN");
    assert.equal((await hv("400", "25000", 1)).status, 201);
    assert.equal((await j(await api("GET", `/seasons/${st.id}/harvests`))).length, 2);
    const sp = await api("PUT", `/seasons/${st.id}/sample`, { sampleKg: 10, sampleM2: 100 });
    assert.equal(sp.status, 200);
    const spb = await j(sp);
    assert.equal(spb.mismatchOver30, false);
    assert.equal(spb.totalHarvestKg, "1000");
    const ph = await api("POST", `/seasons/${st.id}/photos`, { kind: "SAMPEL", objectKey: `sampel/${tag}/1.jpg`, sha256: sha(), takenAt: ago(1).toISOString() });
    assert.equal(ph.status, 201);
    assert.equal((await j(ph)).kind, "SAMPEL");
  });

  test("7. close -> SELESAI; yieldKg, harga tertimbang, untung Decimal, label", async () => {
    const r = await api("POST", `/seasons/${st.id}/close`, { totalCostJt: "2" });
    assert.equal(r.status, 200);
    const b = await j(r);
    assert.equal(b.summary.status, "SELESAI");
    assert.equal(b.record.yieldKg, "1000");
    assert.equal(b.record.pricePerKg, "22000");
    assert.equal(b.summary.pricePerKg, "22000");
    assert.equal(b.summary.revenueJt, "22");
    assert.equal(b.summary.totalCostJt, "2");
    assert.equal(b.summary.profitJt, "20");
    assert.equal(b.summary.isProfit, true);
    assert.equal(typeof b.summary.profitJt, "string");
    assert.equal(b.summary.mismatchOver30, false);
    assert.equal(b.record.label, `Cabai merah ${day(1)}`);
    assert.equal((await j(await api("GET", `/seasons/${st.id}`))).status, "SELESAI");
  });

  test("8. setelah SELESAI: semua perubahan dan tutup lagi -> 409", async () => {
    assert.equal((await api("PATCH", `/seasons/${st.id}`, { capitalJt: 9 })).status, 409);
    assert.equal((await api("POST", `/seasons/${st.id}/expenses`, { category: "LAIN", amountJt: "1", spentOn: day(0) })).status, 409);
    assert.equal((await api("DELETE", `/seasons/${st.id}/expenses/${st.expenseId}`)).status, 409);
    assert.equal((await api("POST", `/seasons/${st.id}/harvests`, { kg: "10", pricePerKg: "20000", harvestedOn: day(0), grade: "A" })).status, 409);
    assert.equal((await api("POST", `/seasons/${st.id}/close`, { totalCostJt: "2" })).status, 409);
    assert.equal(await prisma.seasonRecord.count({ where: { seasonId: st.id } }), 1);
    assert.equal(await prisma.expense.count({ where: { seasonId: st.id } }), 4);
  });

  test("9. musim baru pada lahan yang sama boleh dibuat", async () => {
    const r = await api("POST", `/farms/${st.farmId}/seasons`, { crop: "TOMAT" });
    assert.equal(r.status, 201);
    const s = await j(r);
    assert.notEqual(s.id, st.id);
    assert.equal(s.status, "DRAFT");
    assert.equal(s.costPlan, null);
    st.id2 = s.id;
    assert.equal((await api("POST", `/farms/${st.farmId}/seasons`, { crop: "CABAI" })).status, 409, "satu musim terbuka per lahan");
  });

  test("10. cabang: hentikan pembiayaan -> DRAFT, angka hilang, riwayat ada; mulai lagi -> angka muncul", async () => {
    engineOut = OUT1;
    assert.equal((await api("POST", `/seasons/${st.id2}/start-financing`, BODY)).status, 201);
    const stop = await api("POST", `/seasons/${st.id2}/stop-financing`);
    assert.equal(stop.status, 200);
    const sb = await j(stop);
    assert.equal(sb.status, "DRAFT");
    assert.equal(sb.costPlan, null);
    assert.ok(sb.financingStoppedAt);
    assert.equal((await j(await api("GET", `/seasons/${st.id2}`))).costPlan, null);
    assert.equal(await prisma.costPlan.count({ where: { seasonId: st.id2 } }), 1, "riwayat CostPlan tetap ada");
    assert.equal((await api("POST", `/seasons/${st.id2}/recalc-cost`, BODY)).status, 409);

    engineOut = OUT2;
    const again = await api("POST", `/seasons/${st.id2}/start-financing`, BODY);
    assert.equal(again.status, 201);
    assert.equal((await j(again)).plan.totalJt, "12.25");
    const s = await j(await api("GET", `/seasons/${st.id2}`));
    assert.equal(s.status, "PEMBIAYAAN");
    assert.equal(s.costPlan.totalJt, "12.25");
    assert.equal(await prisma.costPlan.count({ where: { seasonId: st.id2 } }), 2);

    const rc = await api("POST", `/seasons/${st.id2}/recalc-cost`, {});
    assert.equal(rc.status, 200);
    const rb = await j(rc);
    assert.equal(rb.plan.kind, "HITUNG_ULANG");
    assert.equal("input" in rb.plan, false);
    assert.equal("seasonId" in rb.plan, false);
  });
});
