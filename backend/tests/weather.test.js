import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { weekWindows, summarize, HEAVY_RAIN_WEEK_MM } from "../src/utils/weather.js";

// Hari k sejak 2026-01-01 (UTC).
const day = (k) => new Date(Date.UTC(2026, 0, 1 + k)).toISOString().slice(0, 10);
const mk = (rains, temps) => rains.map((r, i) => ({ date: day(i), rainMm: r, tempMax: Array.isArray(temps) ? temps[i] : temps }));

describe("weekWindows", () => {
  test("membagi musim jadi minggu penuh 7 hari berurutan", () => {
    const w = weekWindows("2026-01-01", 3, "2026-01-09");
    assert.deepEqual(w.map((x) => [x.minggu, x.start, x.end]), [
      [1, "2026-01-01", "2026-01-07"],
      [2, "2026-01-08", "2026-01-14"],
      [3, "2026-01-15", "2026-01-21"],
    ]);
    assert.deepEqual(w.map((x) => x.passed), [true, false, false]);
  });
  test("hari ini belum dianggap lewat; sehari sesudah hari terakhir minggu sudah lewat", () => {
    assert.equal(weekWindows("2026-01-01", 1, "2026-01-07")[0].passed, false);
    assert.equal(weekWindows("2026-01-01", 1, "2026-01-08")[0].passed, true);
  });
});

describe("summarize", () => {
  test("rata-rata hujan per minggu dan suhu maksimum", () => {
    // minggu 1: 10+20+30+0+0+5+5 = 70 ; minggu 2: 7 x 20 = 140
    const daily = mk([10, 20, 30, 0, 0, 5, 5, 20, 20, 20, 20, 20, 20, 20], [30, 30, 30, 30, 30, 30, 30, 32, 32, 32, 32, 32, 32, 32]);
    const s = summarize(daily, 2);
    assert.equal(s.rainAvgMm, 105); // (70 + 140) / 2
    assert.equal(s.tempMaxAvg, 31); // (7*30 + 7*32) / 14
    assert.equal(s.weeksCounted, 2);
    assert.equal(s.heavyRainWks, 0);
    assert.equal(s.full, true);
    assert.deepEqual(s.weeks, [{ minggu: 1, rainMm: 70, tempMaxAvg: 30 }, { minggu: 2, rainMm: 140, tempMaxAvg: 32 }]);
  });
  test("ambang 150 mm persis dihitung, di atasnya dihitung, di bawahnya tidak", () => {
    assert.equal(HEAVY_RAIN_WEEK_MM, 150);
    const wk = (a, b, c) => [a, b, c, 0, 0, 0, 0];
    const s = summarize(mk([...wk(50, 50, 50), ...wk(50, 50, 50.1), ...wk(50, 50, 49.9)], 30), 3);
    assert.deepEqual(s.weeks.map((w) => w.rainMm), [150, 150.1, 149.9]);
    assert.equal(s.heavyRainWks, 2);
  });
  test("null tidak dianggap 0: minggu tidak lengkap tidak dihitung dan full=false", () => {
    // minggu 1: 7 x 10 = 70 ; minggu 2: satu hari hujan null ; suhu hari ke-14 null
    const rain = [10, 10, 10, 10, 10, 10, 10, 100, 100, null, 100, 100, 100, 100];
    const temp = [30, 30, 30, 30, 30, 30, 30, 40, 40, 40, 40, 40, 40, null];
    const s = summarize(mk(rain, temp), 2);
    assert.equal(s.weeksCounted, 1);
    assert.equal(s.rainAvgMm, 70); // bila null dianggap 0, hasilnya bukan 70
    assert.equal(s.weeks[1].rainMm, null);
    assert.equal(s.tempMaxAvg, 34.62); // (210 + 6*40) / 13 = 34.615...
    assert.equal(s.full, false);
  });
  test("hari tanpa data (tanggal hilang) tidak dihitung dan full=false", () => {
    const daily = mk([1, 1, 1, 1, 1, 1, 1], 30).filter((d) => d.date !== day(3));
    const s = summarize(daily, 1, day(0));
    assert.equal(s.full, false);
    assert.equal(s.weeksCounted, 0);
    assert.equal(s.rainAvgMm, null);
    assert.equal(s.tempMaxAvg, 30);
  });
  test("tanpa data sama sekali -> null, bukan 0", () => {
    const s = summarize([], 2);
    assert.equal(s.rainAvgMm, null);
    assert.equal(s.tempMaxAvg, null);
    assert.equal(s.full, false);
  });
});
