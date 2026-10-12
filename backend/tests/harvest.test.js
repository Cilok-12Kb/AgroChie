import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { parseHarvestCreate, parseSample } from "../src/validators/harvest.validator.js";
import { mismatchOver30 } from "../src/services/harvest.service.js";

const NOW = new Date("2026-06-10T03:00:00.000Z"); // 10 Juni 2026 WIB
const ok = { kg: 100, pricePerKg: 25000, harvestedOn: "2026-06-01", grade: "A" };

test("panen valid: kg dan harga menjadi string Decimal, tanggal Date UTC", () => {
  const r = parseHarvestCreate({ ...ok, kg: "12.5", buyer: " Pak Budi " }, NOW);
  assert.equal(r.weightKg, "12.5");
  assert.equal(r.pricePerKg, "25000");
  assert.equal(r.harvestedOn.toISOString(), "2026-06-01T00:00:00.000Z");
  assert.equal(r.grade, "A");
  assert.equal(r.buyer, "Pak Budi");
});

test("panen ditolak 400: kg/harga <= 0, desimal, tanggal, grade, kunci lain", () => {
  const bad = [
    { ...ok, kg: 0 }, { ...ok, kg: -1 }, { ...ok, kg: "1.234" }, { ...ok, kg: "abc" }, { ...ok, kg: undefined },
    { ...ok, pricePerKg: 0 }, { ...ok, pricePerKg: -5 }, { ...ok, pricePerKg: undefined },
    { ...ok, harvestedOn: "2026-06-11" }, { ...ok, harvestedOn: "2026-02-31" }, { ...ok, harvestedOn: undefined },
    { ...ok, grade: "Z" }, { ...ok, grade: undefined }, { ...ok, foo: 1 },
  ];
  for (const b of bad) assert.throws(() => parseHarvestCreate(b, NOW), (e) => e.status === 400, JSON.stringify(b));
});

test("sampel: sampleKg dan sampleM2 wajib > 0, kunci lain ditolak", () => {
  assert.deepEqual(parseSample({ sampleKg: 5, sampleM2: "10.5" }), { sampleKg: "5", sampleM2: "10.5" });
  for (const b of [{ sampleKg: 0, sampleM2: 1 }, { sampleKg: 1, sampleM2: -1 }, { sampleKg: 1 }, { sampleM2: 1 }, { sampleKg: 1, sampleM2: 1, x: 1 }, {}]) {
    assert.throws(() => parseSample(b), (e) => e.status === 400, JSON.stringify(b));
  }
});

test("mismatchOver30: 30 persis false, di atasnya true, tanpa data null", () => {
  // sampel 10 kg / 100 m2 x 10000 x 1 ha = 1000 kg perkiraan
  const s = { sampleKg: "10", sampleM2: "100" };
  const A = new Prisma.Decimal(1);
  assert.equal(mismatchOver30(s, "1000", A), false);
  assert.equal(mismatchOver30(s, "1300", A), false); // +30% persis
  assert.equal(mismatchOver30(s, "700", A), false); // -30% persis
  assert.equal(mismatchOver30(s, "1300.01", A), true);
  assert.equal(mismatchOver30(s, "699.99", A), true);
  assert.equal(mismatchOver30(null, "1000", A), null);
  assert.equal(mismatchOver30(s, null, A), null);
  assert.equal(mismatchOver30(s, "0", A, false), null);
});
