import { test, mock } from "node:test";
import assert from "node:assert/strict";
process.env.DATABASE_URL = "postgresql://x:y@localhost:5432/z";
process.env.ENGINE_INTERNAL_KEY = "kunci-uji";

const { toEngineInput, toModelProvince, checkLeafCrop } = await import("../src/utils/engine-input.js");
const { engineCost, summarize422 } = await import("../src/services/engine.service.js");

const farm = { soilType: "Lempung", waterSource: "Irigasi teknis", province: "Jawa Tengah", ph: "6.0",
  nitrogen: "SEDANG", phosphorus: "SEDANG", potassium: "TINGGI" };
const season = { crop: "CABAI", areaHa: "0.50", plantedOn: null };
const weather = { rainAvgMm: 60, heavyRainWks: 1, tempMaxAvg: 30 };
const indices = { fertIndex: 105, wageIndex: 103, pestIndex: 104 };

test("masukan engine memakai nama kolom dan nilai persis seperti dataset latih", () => {
  const x = toEngineInput({ farm, season, weather, indices, startMonth: 9 });
  assert.deepEqual(Object.keys(x), ["komoditas", "luas_ha", "jenis_tanah", "sumber_air", "provinsi", "bulan_tanam",
    "hujan_mm_rata_per_minggu", "minggu_hujan_lebat", "suhu_maks_rata", "ph", "fosfor", "nitrogen", "kalium",
    "indeks_harga_pupuk", "indeks_upah", "indeks_harga_pestisida"]);
  assert.equal(x.komoditas, "cabai");
  assert.equal(x.fosfor, "sedang");
  assert.equal(x.kalium, "tinggi");
  assert.equal(x.luas_ha, 0.5);
  assert.equal(x.ph, 6);
});

test("isian kosong ditolak dengan daftar, tidak ditebak", () => {
  assert.throws(() => toEngineInput({ farm: { ...farm, ph: null, potassium: null }, season, weather, indices, startMonth: 9 }),
    (e) => e.status === 400 && /pH/.test(e.message) && /kalium/.test(e.message));
  assert.throws(() => toEngineInput({ farm, season, weather, indices }), (e) => /bulan tanam/.test(e.message));
  const planted = { ...season, plantedOn: new Date("2026-09-14") };
  assert.equal(toEngineInput({ farm, season: planted, weather, indices }).bulan_tanam, 9);
});

// [REVISI] provinsi teks bebas dipetakan ke provinsi model
test("toModelProvince: cocok tanpa beda huruf/spasi/awalan; di luar daftar atau negara lain -> cadangan", () => {
  assert.deepEqual(toModelProvince("ID", "provinsi jawa tengah"), { value: "Jawa Tengah", fallback: false });
  assert.deepEqual(toModelProvince("ID", "  Jawa   Timur "), { value: "Jawa Timur", fallback: false });
  assert.deepEqual(toModelProvince("ID", "Jawa Barat"), { value: "Jawa Barat", fallback: false });
  assert.deepEqual(toModelProvince("MY", "Jawa Barat"), { value: "Jawa Barat", fallback: true });
  assert.deepEqual(toModelProvince("MY", "Selangor"), { value: "Jawa Barat", fallback: true });
  assert.deepEqual(toModelProvince("ID", "Bali"), { value: "Jawa Barat", fallback: true });
  assert.deepEqual(toModelProvince("ID", null), { value: "Jawa Barat", fallback: true });
});

test("masukan engine: provinsi di luar daftar tidak pernah sampai ke engine; cuaca tetap dari body (tanpa iklim per provinsi)", () => {
  const bali = toEngineInput({ farm: { ...farm, province: "Bali", country: "ID" }, season, weather, indices, startMonth: 9 });
  const my = toEngineInput({ farm: { ...farm, province: "Selangor", country: "MY" }, season, weather, indices, startMonth: 9 });
  const jateng = toEngineInput({ farm: { ...farm, country: "ID" }, season, weather, indices, startMonth: 9 });
  assert.equal(bali.provinsi, "Jawa Barat");
  assert.equal(my.provinsi, "Jawa Barat");
  assert.equal(jateng.provinsi, "Jawa Tengah");
  // fitur iklim tidak bergantung pada provinsi: sama persis untuk semua wilayah, tidak kosong/NaN
  for (const x of [bali, my, jateng]) {
    assert.equal(x.hujan_mm_rata_per_minggu, 60);
    assert.equal(x.minggu_hujan_lebat, 1);
    assert.equal(x.suhu_maks_rata, 30);
  }
});

test("hasil daun yang bukan tanaman musim ditandai", () => {
  const r = { label: "tomat__health", crop: "tomat", healthy: true };
  assert.equal(checkLeafCrop(r, "CABAI").crop_mismatch, true);
  assert.equal(checkLeafCrop(r, "TOMAT").crop_mismatch, false);
  assert.equal(checkLeafCrop(r, undefined).crop_mismatch, undefined); // tanpa tanaman musim: tidak ditandai
});

test("galat engine dipetakan ke status backend yang benar", async () => {
  const reply = (status, body) => async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  mock.method(globalThis, "fetch", reply(200, { total_jt: { mid: 1 } }));
  assert.deepEqual(await engineCost({}), { total_jt: { mid: 1 } });
  assert.equal(globalThis.fetch.mock.calls[0].arguments[1].headers["x-internal-key"], "kunci-uji");

  mock.method(globalThis, "fetch", reply(422, { detail: [{ loc: ["body", "ph"], msg: "kurang dari 3" }] }));
  await assert.rejects(engineCost({}), (e) => e.status === 400 && /ph: kurang dari 3/.test(e.message));

  mock.method(globalThis, "fetch", reply(503, { detail: "x" }));
  await assert.rejects(engineCost({}), (e) => e.status === 503);

  mock.method(globalThis, "fetch", reply(401, { detail: "x" }));
  await assert.rejects(engineCost({}), (e) => e.status === 502);

  mock.method(globalThis, "fetch", async () => { throw new TypeError("fetch failed"); });
  await assert.rejects(engineCost({}), (e) => e.status === 503 && /engine menyala/.test(e.message));
  mock.restoreAll();
  assert.equal(summarize422(null), "format tidak sesuai");
});