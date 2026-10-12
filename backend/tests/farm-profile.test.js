import { test } from "node:test";
import assert from "node:assert/strict";
import { profileCompleteness, outOfTrainingRange, COMPLETENESS_ITEMS } from "../src/utils/farm-profile.js";

const full = {
  village: "Desa A", subdistrict: "Kec B", province: "Jawa Barat", soilType: "Lempung",
  waterSource: "Irigasi teknis", ph: "6.5", nitrogen: "SEDANG", phosphorus: "RENDAH", potassium: "TINGGI",
  latitude: "-6.9", longitude: "107.6", capitalJt: "10", sellPricePerKg: "30000",
};
const KEYS = COMPLETENESS_ITEMS.map((i) => i.key);

test("ada tepat 12 butir", () => assert.equal(COMPLETENESS_ITEMS.length, 12));

test("semua kosong -> 0 persen, 12 butir missing", () => {
  const r = profileCompleteness({ name: "Lahan utama", areaHa: "1" }); // name & areaHa bukan butir
  assert.equal(r.percent, 0);
  assert.deepEqual(r.missing, KEYS);
});

test("semua terisi -> 100 persen, missing kosong", () => {
  assert.deepEqual(profileCompleteness(full), { percent: 100, missing: [] });
});

for (const k of KEYS) {
  test(`butir ${k} kosong muncul di missing`, () => {
    const farm = { ...full };
    for (const f of COMPLETENESS_ITEMS.find((i) => i.key === k).fields) farm[f] = null;
    const r = profileCompleteness(farm);
    assert.deepEqual(r.missing, [k]);
    assert.equal(r.percent, 92); // 11/12 = 91,67 -> 92
  });
}

test("string kosong/spasi dianggap kosong; angka 0 dianggap terisi", () => {
  const r = profileCompleteness({ ...full, village: "", subdistrict: "   ", capitalJt: 0, ph: 0 });
  assert.deepEqual(r.missing, ["village", "subdistrict"]);
});

test("lokasi hanya terisi bila lintang dan bujur keduanya terisi", () => {
  assert.deepEqual(profileCompleteness({ ...full, longitude: null }).missing, ["lokasi"]);
  assert.deepEqual(profileCompleteness({ ...full, latitude: undefined }).missing, ["lokasi"]);
  assert.deepEqual(profileCompleteness({ ...full, latitude: 0, longitude: 0 }).missing, []);
});

test("pembulatan persen: 6/12 = 50, 1/12 = 8", () => {
  const half = { ...full, village: null, subdistrict: null, province: null, soilType: null, waterSource: null, ph: null };
  assert.equal(profileCompleteness(half).percent, 50);
  assert.equal(profileCompleteness({ village: "x" }).percent, 8);
});

test("rentang latih: dalam rentang -> false, alasan kosong", () => {
  assert.deepEqual(outOfTrainingRange({ areaHa: "1.5", ph: "6.5" }), { di_luar_rentang_latih: false, alasan: [] });
});

test("batas tepat luas 3,0 dan pH 4,5 / 7,5 tidak di luar rentang", () => {
  assert.equal(outOfTrainingRange({ areaHa: "3.00" }).di_luar_rentang_latih, false);
  assert.equal(outOfTrainingRange({ areaHa: 3, ph: "4.5" }).di_luar_rentang_latih, false);
  assert.equal(outOfTrainingRange({ areaHa: 3, ph: "7.5" }).di_luar_rentang_latih, false);
});

test("sedikit di atas/bawah batas -> di luar rentang", () => {
  assert.deepEqual(outOfTrainingRange({ areaHa: "3.01" }), { di_luar_rentang_latih: true, alasan: ["luas"] });
  assert.deepEqual(outOfTrainingRange({ areaHa: "1", ph: "4.4" }), { di_luar_rentang_latih: true, alasan: ["ph"] });
  assert.deepEqual(outOfTrainingRange({ areaHa: "1", ph: "7.6" }), { di_luar_rentang_latih: true, alasan: ["ph"] });
});

test("ph null/kosong tidak ditandai (tidak ditebak)", () => {
  assert.deepEqual(outOfTrainingRange({ areaHa: "2", ph: null }), { di_luar_rentang_latih: false, alasan: [] });
  assert.deepEqual(outOfTrainingRange({ areaHa: "4", ph: undefined }), { di_luar_rentang_latih: true, alasan: ["luas"] });
});

test("kedua alasan sekaligus: ['luas','ph']", () => {
  assert.deepEqual(outOfTrainingRange({ areaHa: "4.5", ph: "3.2" }), { di_luar_rentang_latih: true, alasan: ["luas", "ph"] });
});

test("menerima objek Decimal-like (toString/valueOf angka)", () => {
  const dec = (s) => ({ toString: () => s, valueOf: () => s });
  assert.equal(outOfTrainingRange({ areaHa: dec("3.5") }).di_luar_rentang_latih, true);
});
