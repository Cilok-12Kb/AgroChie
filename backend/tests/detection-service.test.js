import { test } from "node:test";
import assert from "node:assert/strict";
import { createDetectionService } from "../src/services/detection/index.js";
import { buildEnv } from "../src/config/env-parse.js";

const silent = () => { const o = console.error; console.error = () => {}; return () => { console.error = o; }; };
const IMG = Buffer.from("ffd8ffe000104a46494600010100", "hex");

const detOk = {
  tanaman_terlihat: true, kondisi: "Daun cabai bercak", kategori_kualitas: "sedang", skor_kepercayaan: 0.8,
  masalah_terdeteksi: [{ nama: "Bercak daun", jenis: "penyakit", tingkat_keparahan: "ringan", gejala_terlihat: "bercak cokelat" }],
};
const mk = (out, minConfidence = 0.5) => createDetectionService({ provider: { name: "uji", detect: async () => out }, minConfidence });

test("detectionService: SELESAI, keyakinan rendah, dan bukan tanaman", async () => {
  const ok = await mk(detOk).detect(IMG, "image/jpeg", {});
  assert.equal(ok.status, "SELESAI");
  assert.equal(ok.provider, "uji");
  assert.equal(ok.alasan, null);

  const low = await mk({ ...detOk, skor_kepercayaan: 0.49 }).detect(IMG, "image/jpeg", {});
  assert.equal(low.status, "TIDAK_YAKIN");
  assert.equal(low.alasan, "keyakinan_rendah");
  assert.match(low.pesan, /lebih jelas/);

  const edge = await mk({ ...detOk, skor_kepercayaan: 0.5 }).detect(IMG, "image/jpeg", {});
  assert.equal(edge.status, "SELESAI"); // hanya < ambang yang tidak yakin

  const notPlant = await mk({ ...detOk, tanaman_terlihat: false, skor_kepercayaan: 0.95 }).detect(IMG, "image/jpeg", {});
  assert.equal(notPlant.status, "TIDAK_YAKIN");
  assert.equal(notPlant.alasan, "bukan_tanaman");
});

test("detectionService menolak keluaran provider yang menyimpang dari skema", async () => {
  const restore = silent();
  try {
    const badProblem = [{ nama: "x", jenis: "alien", tingkat_keparahan: "ringan", gejala_terlihat: "y" }];
    for (const bad of [{ ...detOk, kategori_kualitas: "bagus" }, { ...detOk, skor_kepercayaan: 1.5 }, { ...detOk, masalah_terdeteksi: badProblem }]) {
      await assert.rejects(mk(bad).detect(IMG, "image/jpeg", {}), (e) => e.code === "AI_INVALID_OUTPUT");
    }
  } finally { restore(); }
});

test("env: nilai bawaan dan validasi ambang deteksi", () => {
  const base = { DATABASE_URL: "postgresql://x", JWT_SECRET: "a".repeat(32) };
  const e = buildEnv(base);
  assert.equal(e.detectionProvider, "engine"); // [REVISI] bawaan berubah dari gemini ke engine
  assert.equal(e.detectionMinConfidence, 0.5);
  assert.equal(e.geminiTimeoutMs, 30000);
  assert.throws(() => buildEnv({ ...base, DETECTION_MIN_CONFIDENCE: "2" }), /DETECTION_MIN_CONFIDENCE/);
  assert.throws(() => buildEnv({ ...base, GEMINI_TIMEOUT_MS: "0" }), /GEMINI_TIMEOUT_MS/);
});
