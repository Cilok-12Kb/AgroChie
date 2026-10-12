import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSeasonCreate } from "../src/validators/season.validator.js";

const status = (fn) => {
  try { fn(); return 200; } catch (e) { return e.status; }
};

test("crop valid diterima", () => {
  for (const crop of ["CABAI", "BAWANG", "TOMAT"]) assert.deepEqual(parseSeasonCreate({ crop }), { crop });
});
test("kunci tak dikenal -> 400", () => {
  assert.equal(status(() => parseSeasonCreate({ crop: "CABAI", areaHa: 1 })), 400);
  assert.equal(status(() => parseSeasonCreate({ crop: "CABAI", status: "TANAM" })), 400);
});
test("crop salah atau huruf kecil -> 400", () => {
  assert.equal(status(() => parseSeasonCreate({ crop: "JAGUNG" })), 400);
  assert.equal(status(() => parseSeasonCreate({ crop: "cabai" })), 400);
});
test("crop wajib -> 400", () => {
  assert.equal(status(() => parseSeasonCreate({})), 400);
  assert.equal(status(() => parseSeasonCreate(undefined)), 400);
});


// ---- 18.4: PATCH Season ----
import { parseSeasonPatch } from "../src/validators/season.validator.js";

test("patch: parsial hanya membawa kunci yang dikirim; null untuk rupiah", () => {
  assert.deepEqual(parseSeasonPatch({ capitalJt: 10 }), { capitalJt: "10" });
  assert.deepEqual(parseSeasonPatch({ capitalJt: null, sellPricePerKg: "30000.5" }), { capitalJt: null, sellPricePerKg: "30000.5" });
});
test("patch: kunci tak dikenal dan body kosong -> 400", () => {
  for (const b of [{ status: "TANAM" }, { id: "x" }, { farmId: "x" }, { crop: "CABAI", note: 1 }, {}, undefined]) {
    assert.equal(status(() => parseSeasonPatch(b)), 400);
  }
});
test("patch: batas luas, rupiah negatif, null pada crop/areaHa -> 400", () => {
  for (const b of [{ areaHa: 0.05 }, { areaHa: 5.01 }, { areaHa: 1.234 }, { areaHa: null }, { crop: null }, { crop: "JAGUNG" },
    { capitalJt: -1 }, { sellPricePerKg: "-5" }, { profitTargetJt: -0.01 }, { capitalJt: 1.234 }]) {
    assert.equal(status(() => parseSeasonPatch(b)), 400, JSON.stringify(b));
  }
  assert.deepEqual(parseSeasonPatch({ areaHa: 0.1 }), { areaHa: "0.1" });
  assert.deepEqual(parseSeasonPatch({ areaHa: 5 }), { areaHa: "5" });
});
