import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFarmPatch } from "../src/validators/farm.validator.js";

const bad = (body, re) => assert.throws(() => parseFarmPatch(body), (e) => e.status === 400 && re.test(e.message));
const ok = (body) => parseFarmPatch(body);

test("hanya kunci yang dikirim yang muncul (parsial)", () => {
  assert.deepEqual(Object.keys(ok({ village: "Desa A" })), ["village"]);
});

test("body kosong ditolak", () => bad({}, /Tidak ada isian/));

test("kunci tak dikenal (id, userId, boundary) ditolak", () => {
  bad({ userId: "x" }, /tidak dikenal/);
  bad({ id: "x", village: "a" }, /tidak dikenal/);
});

test("batas pH 3,0 sampai 9,0 dan harus disertai tanggal ukur", () => {
  assert.equal(ok({ ph: 3, phMeasuredOn: "2026-01-15" }).ph, "3");
  assert.equal(ok({ ph: "9.0", phMeasuredOn: "2026-01-15" }).ph, "9.0");
  bad({ ph: 2.9, phMeasuredOn: "2026-01-15" }, /pH/);
  bad({ ph: 9.1, phMeasuredOn: "2026-01-15" }, /pH/);
  bad({ ph: 6.55, phMeasuredOn: "2026-01-15" }, /desimal/);
  bad({ ph: 6.5 }, /phMeasuredOn/);
  bad({ phMeasuredOn: "2026-01-15" }, /tanpa ph/);
  bad({ ph: 6.5, phMeasuredOn: "2026-02-31" }, /tidak valid/);
  bad({ ph: 6.5, phMeasuredOn: "15-01-2026" }, /YYYY-MM-DD/);
  bad({ ph: 6.5, phMeasuredOn: "2999-01-01" }, /masa depan/);
});

test("pH dikosongkan (null) ikut mengosongkan tanggal ukur", () => {
  assert.deepEqual(ok({ ph: null }), { ph: null, phMeasuredOn: null });
});

test("batas luas 0,1 sampai 5 ha; null ditolak", () => {
  assert.equal(ok({ areaHa: 0.1 }).areaHa, "0.1");
  assert.equal(ok({ areaHa: 5 }).areaHa, "5");
  bad({ areaHa: 0.09 }, /Luas/);
  bad({ areaHa: 5.01 }, /Luas/);
  bad({ areaHa: 0 }, /Luas/);
  bad({ areaHa: null }, /Luas/);
  bad({ areaHa: "abc" }, /Luas/);
});

test("koordinat: rentang, harus berpasangan, tertukar ditolak", () => {
  assert.deepEqual(ok({ latitude: -6.9, longitude: 107.6 }), { latitude: "-6.9", longitude: "107.6" });
  assert.deepEqual(ok({ latitude: null, longitude: null }), { latitude: null, longitude: null });
  bad({ latitude: 107.6, longitude: -6.9 }, /latitude/); // tertukar: lintang di luar -90..90
  bad({ latitude: 91, longitude: 0 }, /latitude/);
  bad({ latitude: 0, longitude: 181 }, /longitude/);
  bad({ latitude: -6.9 }, /bersamaan/);
});

test("enum salah ditolak; nilai persis seperti skema", () => {
  assert.equal(ok({ nitrogen: "SEDANG" }).nitrogen, "SEDANG");
  bad({ nitrogen: "sedang" }, /nitrogen/);
  bad({ phosphorus: "TINGGIII" }, /phosphorus/);
  bad({ potassium: "X" }, /potassium/);
  bad({ soilType: "Batu" }, /Jenis tanah/);
  bad({ waterSource: "Hujan" }, /Sumber air/);
  assert.equal(ok({ province: "Jawa Barat" }).province, "Jawa Barat");
});

// [REVISI] provinsi kini teks bebas
test("provinsi teks bebas: Bali diterima, trim, kosong jadi null, > 100 ditolak", () => {
  assert.equal(ok({ province: "Bali" }).province, "Bali");
  assert.equal(ok({ province: "  Selangor  " }).province, "Selangor");
  assert.equal(ok({ province: "   " }).province, null);
  assert.equal(ok({ province: "a".repeat(100) }).province.length, 100);
  bad({ province: "a".repeat(101) }, /Maksimal 100/);
});

test("negara: huruf kecil jadi besar; 1 huruf, 3 huruf, angka ditolak", () => {
  assert.equal(ok({ country: "my" }).country, "MY");
  assert.equal(ok({ country: " id " }).country, "ID");
  bad({ country: "I" }, /Negara/);
  bad({ country: "IDN" }, /Negara/);
  bad({ country: "1D" }, /Negara/);
  bad({ country: null }, /Negara/);
});

test("rupiah: Decimal sebagai string, tidak negatif, maksimal 2 desimal", () => {
  const r = ok({ capitalJt: 12.5, sellPricePerKg: "30000", profitTargetJt: 0 });
  assert.deepEqual(r, { capitalJt: "12.5", sellPricePerKg: "30000", profitTargetJt: "0" });
  for (const v of Object.values(r)) assert.equal(typeof v, "string");
  bad({ capitalJt: -1 }, /capitalJt/);
  bad({ sellPricePerKg: 1.234 }, /desimal/);
  assert.equal(ok({ capitalJt: null }).capitalJt, null);
});

test("teks kosong menjadi null; panjang dibatasi", () => {
  assert.deepEqual(ok({ village: "  ", note: null }), { village: null, note: null });
  bad({ note: "x".repeat(501) }, /Maksimal/);
  bad({ name: "" }, /Nama lahan/);
});
