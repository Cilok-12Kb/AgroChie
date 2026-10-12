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

