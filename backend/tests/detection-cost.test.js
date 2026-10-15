import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { rupiahToJt, recalculateCost, categoryForItem, expenseCategoryFor, assertRupiah } from "../src/utils/detection-cost.js";

const EXPENSE_ENUM = ["BENIH", "PUPUK", "OBAT", "TENAGA_KERJA", "LAIN"];

test("Rupiah penuh -> Decimal juta Rupiah, tepat tanpa float", () => {
  const d = rupiahToJt(150000);
  assert.ok(d instanceof Prisma.Decimal);
  assert.equal(d.toString(), "0.15");
  assert.equal(rupiahToJt(1234567).toString(), "1.234"); // min: turun
  assert.equal(rupiahToJt(1234567, "up").toString(), "1.235"); // max: naik
  assert.equal(rupiahToJt(0).toString(), "0");
});

test("nilai negatif, bukan angka, dan melewati batas ditolak", () => {
  assert.throws(() => rupiahToJt(-1), /negatif/);
  assert.throws(() => assertRupiah(NaN), /angka/);
  assert.throws(() => assertRupiah("100"), /angka/);
  assert.throws(() => assertRupiah(1e12), /batas/);
});

test("total dihitung ulang dari bahan dan dikoreksi bila klaim AI salah", () => {
  const bahan = [
    { nama: "A", dosis_atau_jumlah: "1", estimasi_biaya_min: 50000, estimasi_biaya_max: 80000 },
    { nama: "B", dosis_atau_jumlah: "2", estimasi_biaya_min: 20000, estimasi_biaya_max: 30000 },
  ];
  const ok = recalculateCost(bahan, { min: 70000, max: 110000 });
  assert.deepEqual(ok.total, { min: 70000, max: 110000 });
  assert.equal(ok.dikoreksi, false);
  const bad = recalculateCost(bahan, { min: 1, max: 2 });
  assert.deepEqual(bad.total, { min: 70000, max: 110000 });
  assert.equal(bad.dikoreksi, true);
  assert.match(bad.catatan[0], /dihitung ulang/);
});

test("min lebih besar dari max pada bahan ditolak", () => {
  assert.throws(
    () => recalculateCost([{ nama: "A", estimasi_biaya_min: 10, estimasi_biaya_max: 5 }]),
    /lebih besar/,
  );
  assert.throws(() => recalculateCost([{ nama: "A", estimasi_biaya_min: -1, estimasi_biaya_max: 5 }]), /negatif/);
});

test("total tanpa bahan = 0 dan tidak dikoreksi tanpa klaim", () => {
  const r = recalculateCost([]);
  assert.deepEqual(r.total, { min: 0, max: 0 });
  assert.equal(r.dikoreksi, false);
});

test("kategori bahan memakai enum ExpenseCategory", () => {
  assert.equal(categoryForItem("Fungisida berbahan aktif tembaga"), "OBAT");
  assert.equal(categoryForItem("Insektisida nabati"), "OBAT");
  assert.equal(categoryForItem("Pupuk kalium (KCl)"), "PUPUK");
  assert.equal(categoryForItem("Kapur dolomit"), "PUPUK");
  assert.equal(categoryForItem("Bibit pengganti"), "BENIH");
  assert.equal(categoryForItem("Upah tenaga penyemprot"), "TENAGA_KERJA");
  assert.equal(categoryForItem("Sarung tangan"), "LAIN");
  for (const n of ["Fungisida", "Pupuk", "Bibit", "Upah tenaga", "Sarung"]) assert.ok(EXPENSE_ENUM.includes(categoryForItem(n)));
});

test("kategori bahan tetap dikenali saat jawaban AI berbahasa Inggris atau Mandarin", () => {
  assert.equal(categoryForItem("copper fungicide"), "OBAT");
  assert.equal(categoryForItem("organic fertilizer"), "PUPUK");
  assert.equal(categoryForItem("人工工资"), "TENAGA_KERJA");
  assert.equal(categoryForItem("番茄种苗"), "BENIH");
});

test("kategori Expense total ditentukan nilai tengah rentang terbesar", () => {
  const r = expenseCategoryFor([
    { nama: "Fungisida tembaga", estimasi_biaya_min: 100000, estimasi_biaya_max: 200000 }, // tengah 150000
    { nama: "Pupuk kalium", estimasi_biaya_min: 20000, estimasi_biaya_max: 40000 }, // tengah 30000
    { nama: "Sarung tangan", estimasi_biaya_min: 10000, estimasi_biaya_max: 20000 },
  ]);
  assert.equal(r.kategori, "OBAT");
  assert.equal(r.rincian.OBAT, 150000);
  assert.equal(r.rincian.PUPUK, 30000);
});

test("kategori Expense: tanpa bahan atau seri -> LAIN", () => {
  assert.equal(expenseCategoryFor([]).kategori, "LAIN");
  assert.equal(
    expenseCategoryFor([
      { nama: "Fungisida", estimasi_biaya_min: 10, estimasi_biaya_max: 30 },
      { nama: "Pupuk", estimasi_biaya_min: 20, estimasi_biaya_max: 20 },
    ]).kategori,
    "LAIN",
  );
});
