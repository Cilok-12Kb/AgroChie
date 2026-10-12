import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFarmCreate, farmPatchSchema } from "../src/validators/farm.validator.js";

const bad = (body, re) => assert.throws(() => parseFarmCreate(body), (e) => e.status === 400 && re.test(e.message));
const base = { name: "Lahan", areaHa: 1 };

test("minimal: name dan areaHa; areaHa menjadi string Decimal", () => {
  assert.deepEqual(parseFarmCreate(base), { name: "Lahan", areaHa: "1" });
});

test("kunci tak dikenal (id, userId) ditolak 400", () => {
  bad({ ...base, userId: "x" }, /tidak dikenal/);
  bad({ ...base, id: "x" }, /tidak dikenal/);
});

test("luas wajib dan 0,1 sampai 5 (sama dengan PATCH)", () => {
  bad({ name: "L" }, /areaHa|Luas|required|expected/i);
  bad({ ...base, areaHa: null }, /Luas/);
  bad({ ...base, areaHa: 0.09 }, /Luas/);
  bad({ ...base, areaHa: 5.01 }, /Luas/);
  assert.equal(parseFarmCreate({ ...base, areaHa: 0.1 }).areaHa, "0.1");
  assert.equal(parseFarmCreate({ ...base, areaHa: 5 }).areaHa, "5");
  // batas POST dan PATCH sama
  for (const v of [0.09, 0.1, 5, 5.01]) {
    const post = (() => { try { parseFarmCreate({ ...base, areaHa: v }); return true; } catch { return false; } })();
    assert.equal(farmPatchSchema.safeParse({ areaHa: v }).success, post, `batas ${v}`);
  }
});

test("koordinat tertukar atau tidak berpasangan ditolak", () => {
  bad({ ...base, latitude: 107.6, longitude: -6.9 }, /latitude/);
  bad({ ...base, latitude: -6.9 }, /bersamaan/);
  bad({ ...base, longitude: 107.6 }, /bersamaan/);
  assert.deepEqual(parseFarmCreate({ ...base, latitude: -6.9, longitude: 107.6 }).latitude, "-6.9");
});

test("pH tanpa tanggal ukur ditolak; di luar 3-9 ditolak", () => {
  bad({ ...base, ph: 6.5 }, /phMeasuredOn/);
  bad({ ...base, phMeasuredOn: "2026-01-15" }, /tanpa ph/);
  bad({ ...base, ph: 9.1, phMeasuredOn: "2026-01-15" }, /pH/);
  assert.equal(parseFarmCreate({ ...base, ph: 6.5, phMeasuredOn: "2026-01-15" }).ph, "6.5");
});

test("enum salah ditolak", () => {
  bad({ ...base, nitrogen: "sedang" }, /nitrogen/);
  bad({ ...base, province: "Bali" }, /Provinsi/);
  bad({ ...base, soilType: "Batu" }, /Jenis tanah/);
  bad({ ...base, waterSource: "Hujan" }, /Sumber air/);
});

test("rupiah negatif ditolak; sah dikirim sebagai string; teks kosong jadi null", () => {
  bad({ ...base, capitalJt: -1 }, /capitalJt/);
  bad({ ...base, sellPricePerKg: -0.5 }, /sellPricePerKg/);
  bad({ ...base, profitTargetJt: 1.234 }, /desimal/);
  const r = parseFarmCreate({ ...base, capitalJt: 12.5, village: "  " });
  assert.equal(r.capitalJt, "12.5");
  assert.equal(r.village, null);
});
