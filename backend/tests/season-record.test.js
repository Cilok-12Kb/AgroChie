import { test } from "node:test";
import assert from "node:assert/strict";
import { weeklyFromExpenses } from "../src/services/season-record.service.js";

const start = new Date("2026-01-05");
const rows = [
  { spentOn: new Date("2026-01-01"), amountJt: 3, simulated: false }, // sebelum musim -> minggu 1
  { spentOn: new Date("2026-01-20"), amountJt: 5, simulated: false }, // minggu 3
  { spentOn: new Date("2027-01-01"), amountJt: 2, simulated: false }, // sesudah musim -> minggu terakhir
  { spentOn: new Date("2026-02-01"), amountJt: 9, simulated: true },  // simulasi, diabaikan
];

test("biaya mingguan dipakai bila cakupan 90-110 persen", () => {
  const { weekly, ratio } = weeklyFromExpenses(rows, start, 16, 10);
  assert.equal(ratio, 1);
  assert.equal(weekly[0], 3);
  assert.equal(weekly[2], 5);
  assert.equal(weekly[15], 2);
});

test("biaya mingguan dikosongkan bila cakupan di luar 90-110 persen", () => {
  assert.equal(weeklyFromExpenses(rows, start, 16, 20).weekly, null);
});