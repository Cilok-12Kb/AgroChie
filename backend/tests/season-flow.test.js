import { test } from "node:test";
import assert from "node:assert/strict";
import { CROP_DURATION, catFrac, CATEGORY_INDEX, currentWeek, harvestEstimate } from "../src/utils/season-flow.js";

const d = (s) => new Date(`${s}T00:00:00.000Z`);

test("durasi tanaman", () => {
  assert.deepEqual({ ...CROP_DURATION }, { CABAI: 16, TOMAT: 14, BAWANG: 10 });
});

test("catFrac dan pemetaan kategori", () => {
  assert.deepEqual([...catFrac], [0.183, 0.309, 0.114, 0.263, 0.131]);
  assert.deepEqual({ ...CATEGORY_INDEX }, { BENIH: 0, PUPUK: 1, OBAT: 2, TENAGA_KERJA: 3, LAIN: 4 });
  assert.equal(Math.round(catFrac.reduce((a, b) => a + b, 0) * 1000) / 1000, 1);
  for (const [k, i] of Object.entries(CATEGORY_INDEX)) assert.ok(catFrac[i] > 0, k);
});

test("currentWeek: minggu 1 di hari tanam, naik tiap 7 hari", () => {
  assert.equal(currentWeek(d("2026-03-01"), d("2026-03-01"), "CABAI"), 1);
  assert.equal(currentWeek(d("2026-03-01"), d("2026-03-07"), "CABAI"), 1);
  assert.equal(currentWeek(d("2026-03-01"), d("2026-03-08"), "CABAI"), 2);
  assert.equal(currentWeek(d("2026-03-01"), d("2026-03-29"), "CABAI"), 5);
});

test("currentWeek: batas bawah dijepit ke 1 (sebelum tanam)", () => {
  assert.equal(currentWeek(d("2026-03-01"), d("2026-02-01"), "TOMAT"), 1);
});

test("currentWeek: batas atas dijepit ke durasi-1 untuk tiap tanaman", () => {
  assert.equal(currentWeek(d("2026-01-01"), d("2027-01-01"), "CABAI"), 15);
  assert.equal(currentWeek(d("2026-01-01"), d("2027-01-01"), "TOMAT"), 13);
  assert.equal(currentWeek(d("2026-01-01"), d("2027-01-01"), "BAWANG"), 9);
  // tepat di minggu ke-15 (cabai) dan minggu ke-16 (dijepit ke 15)
  assert.equal(currentWeek(d("2026-01-01"), d("2026-04-09"), "CABAI"), 15); // hari ke-98 -> minggu 15
  assert.equal(currentWeek(d("2026-01-01"), d("2026-04-16"), "CABAI"), 15); // minggu 16 -> dijepit
});

test("currentWeek: jam tidak memengaruhi hari kalender", () => {
  assert.equal(currentWeek(d("2026-03-01"), new Date("2026-03-07T23:59:59Z"), "CABAI"), 1);
});

test("harvestEstimate = tanam + durasi x 7 hari", () => {
  assert.equal(harvestEstimate(d("2026-03-01"), "CABAI").toISOString().slice(0, 10), "2026-06-21"); // 112 hari
  assert.equal(harvestEstimate(d("2026-03-01"), "TOMAT").toISOString().slice(0, 10), "2026-06-07"); // 98 hari
  assert.equal(harvestEstimate(d("2026-03-01"), "BAWANG").toISOString().slice(0, 10), "2026-05-10"); // 70 hari
});

test("tanaman tidak dikenal atau tanggal rusak -> RangeError", () => {
  assert.throws(() => currentWeek(d("2026-03-01"), d("2026-03-02"), "JAGUNG"), RangeError);
  assert.throws(() => harvestEstimate(d("2026-03-01"), "padi"), RangeError);
  assert.throws(() => harvestEstimate("bukan tanggal", "CABAI"), RangeError);
});
