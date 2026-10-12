import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { parseExpenseCreate } from "../src/validators/expense.validator.js";
import { weeklyFromExpenses } from "../src/services/season-record.service.js";

const NOW = new Date("2026-06-10T03:00:00.000Z"); // 10 Juni 2026 WIB
const ok = { category: "PUPUK", amountJt: 1.25, spentOn: "2026-06-01" };

test("pengeluaran valid: jumlah menjadi string Decimal, tanggal Date UTC, note opsional", () => {
  const r = parseExpenseCreate({ ...ok, note: "  urea  " }, NOW);
  assert.equal(r.amountJt, "1.25");
  assert.equal(r.spentOn.toISOString(), "2026-06-01T00:00:00.000Z");
  assert.equal(r.note, "urea");
  assert.equal(parseExpenseCreate({ ...ok, amountJt: "0.001", spentOn: "2026-06-10" }, NOW).amountJt, "0.001");
  assert.equal(parseExpenseCreate(ok, NOW).note, undefined);
});

test("ditolak 400: kategori, jumlah, tanggal, kunci lain", () => {
  const bad = [
    { ...ok, category: "pupuk" }, { ...ok, category: "BIBIT" }, { ...ok, category: undefined },
    { ...ok, amountJt: 0 }, { ...ok, amountJt: -1 }, { ...ok, amountJt: "1.2345" }, { ...ok, amountJt: "abc" },
    { ...ok, amountJt: 100001 }, { ...ok, amountJt: undefined }, { ...ok, amountJt: "1e3" },
    { ...ok, spentOn: "2026-06-11" }, { ...ok, spentOn: "2026-02-31" }, { ...ok, spentOn: "01-06-2026" }, { ...ok, spentOn: undefined },
    { ...ok, simulated: true }, { ...ok, seasonId: "x" },
  ];
  for (const body of bad) assert.throws(() => parseExpenseCreate(body, NOW), (e) => e.status === 400, JSON.stringify(body));
});

test("weeklyFromExpenses: Decimal, tanpa galat floating point", () => {
  const start = new Date("2026-01-05");
  const rows = [
    { spentOn: new Date("2026-01-05"), amountJt: new Prisma.Decimal("0.1"), simulated: false },
    { spentOn: new Date("2026-01-06"), amountJt: new Prisma.Decimal("0.2"), simulated: false },
    { spentOn: new Date("2026-01-07"), amountJt: "0.7", simulated: false },
  ];
  const { weekly, ratio } = weeklyFromExpenses(rows, start, 16, "1");
  assert.equal(weekly[0], 1); // 0.1+0.2+0.7 persis 1 (Number biasa memberi 0.30000000000000004 pada 0.1+0.2)
  assert.equal(ratio, 1);
});

test("weeklyFromExpenses: batas 90 dan 110 persen masuk, di luarnya null; total 0 -> null", () => {
  const start = new Date("2026-01-05");
  const mk = (v) => [{ spentOn: new Date("2026-01-05"), amountJt: v, simulated: false }];
  assert.ok(weeklyFromExpenses(mk("9"), start, 16, 10).weekly);
  assert.ok(weeklyFromExpenses(mk("11"), start, 16, 10).weekly);
  assert.equal(weeklyFromExpenses(mk("8.999"), start, 16, 10).weekly, null);
  assert.equal(weeklyFromExpenses(mk("11.001"), start, 16, 10).weekly, null);
  assert.equal(weeklyFromExpenses(mk("5"), start, 16, 0).weekly, null);
});
