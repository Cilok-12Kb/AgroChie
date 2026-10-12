import { test } from "node:test";
import assert from "node:assert/strict";
import { seasonView, redactPlan, predictionVisible } from "../src/utils/money-gate.js";

const plan = (over = {}) => ({
  id: "p1", kind: "AWAL", totalJt: "10", p10Jt: "8", p50Jt: "10", p90Jt: "12", capitalJt: "11", shortfallJt: "0",
  breakEvenPerKg: null, weeklyJt: [1, 2, 3], needsRecalc: true, modelVersion: "ms + mw", createdAt: new Date(0),
  input: { rahasia: 1 }, seasonId: "s1", ...over,
});
const season = (status, costPlans) => ({
  id: "s1", status, capitalJt: "11", sellPricePerKg: "25000", profitTargetJt: "5", financingStoppedAt: null, costPlans,
});
const PRED = ["totalJt", "p10Jt", "p50Jt", "p90Jt", "shortfallJt", "weeklyJt", "needsRecalc", "breakEvenPerKg"];

test("DRAFT: costPlan null walau ada riwayat; field Season tetap ada", () => {
  const v = seasonView(season("DRAFT", [plan()]));
  assert.equal(v.costPlan, null);
  assert.equal("costPlans" in v, false);
  assert.equal(v.capitalJt, "11");
  assert.equal(v.sellPricePerKg, "25000");
  assert.equal(v.profitTargetJt, "5");
  assert.equal("financingStoppedAt" in v, true);
});

test("status selain DRAFT: kolom publik plan tampil, input mesin tidak ikut", () => {
  for (const st of ["PEMBIAYAAN", "TANAM", "PANEN", "SELESAI"]) {
    const v = seasonView(season(st, [plan()]));
    for (const k of PRED) assert.ok(k in v.costPlan, `${st}: ${k}`);
    assert.equal(v.costPlan.totalJt, "10");
    assert.equal("input" in v.costPlan, false);
    assert.equal("seasonId" in v.costPlan, false);
  }
});

test("Season tanpa CostPlan (kosong, tidak ada, atau bukan array): costPlan null, tidak error", () => {
  for (const st of ["DRAFT", "PEMBIAYAAN"]) {
    assert.equal(seasonView(season(st, [])).costPlan, null);
    assert.equal(seasonView(season(st, undefined)).costPlan, null);
    assert.equal(seasonView({ ...season(st, null) }).costPlan, null);
  }
  assert.equal(seasonView(null), null);
});

test("tidak mengubah (mutasi) objek masukan", () => {
  for (const st of ["DRAFT", "TANAM"]) {
    const input = season(st, [plan()]);
    const snapshot = structuredClone(input);
    Object.freeze(input.costPlans[0]);
    Object.freeze(input.costPlans);
    Object.freeze(input);
    const out = seasonView(input);
    assert.deepEqual(input, snapshot);
    assert.notEqual(out, input);
  }
});

test("redactPlan dan predictionVisible", () => {
  const p = plan();
  assert.equal(redactPlan("DRAFT", p), null);
  assert.equal(redactPlan("PEMBIAYAAN", p), p);
  assert.equal(redactPlan("TANAM", null), null);
  assert.equal(predictionVisible("DRAFT"), false);
  assert.equal(predictionVisible("PANEN"), true);
});
