import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { parsePhotoCreate } from "../src/validators/photo.validator.js";
import { parseClose } from "../src/validators/close.validator.js";

const SHA = "a".repeat(64);
const ok = (over = {}) => ({ kind: "SAMPEL", objectKey: "sampel/1.jpg", sha256: SHA, takenAt: "2026-06-01T08:30:00Z", ...over });
const NOW = new Date("2026-06-02T00:00:00Z");

describe("Validator foto sampel (metadata)", () => {
  test("valid; sha256 dinormalkan huruf kecil; lokasi opsional", () => {
    const r = parsePhotoCreate(ok({ sha256: SHA.toUpperCase() }), NOW);
    assert.equal(r.sha256, SHA);
    assert.equal(r.latitude, null);
    const g = parsePhotoCreate(ok({ latitude: -7.5, longitude: "110.123456" }), NOW);
    assert.equal(g.latitude, "-7.5");
  });
  test("kunci tak dikenal, kind salah, sha256 salah, objectKey kosong -> 400", () => {
    for (const bad of [ok({ x: 1 }), ok({ kind: "LAIN" }), ok({ sha256: "abc" }), ok({ objectKey: " " }), ok({ takenAt: "bukan" }), ok({ seasonWeek: 3 })]) {
      assert.throws(() => parsePhotoCreate(bad, NOW), (e) => e.status === 400);
    }
  });
  test("lokasi harus berpasangan, rentang valid, waktu tidak di masa depan", () => {
    assert.throws(() => parsePhotoCreate(ok({ latitude: 1 }), NOW), (e) => e.status === 400);
    assert.throws(() => parsePhotoCreate(ok({ latitude: 91, longitude: 1 }), NOW), (e) => e.status === 400);
    assert.throws(() => parsePhotoCreate(ok({ takenAt: "2026-07-01T00:00:00Z" }), NOW), (e) => e.status === 400);
  });
});

describe("Validator body tutup musim", () => {
  test("body kosong diterima (total biaya dicek di service sesuai urutan docs/03)", () => {
    assert.deepEqual(parseClose({}), {});
  });
  test("kunci tak dikenal dan tipe salah -> 400", () => {
    assert.throws(() => parseClose({ status: "SELESAI" }), (e) => e.status === 400);
    assert.throws(() => parseClose({ heavyRainWks: 1.5 }), (e) => e.status === 400);
    assert.throws(() => parseClose({ consentTraining: "ya" }), (e) => e.status === 400);
  });
});
