import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createDetectionService } from "../src/services/detection/index.js";
import { createEngineProvider } from "../src/services/detection/engine-provider.js";
import { HttpError } from "../src/utils/http-error.js";
import { buildEnv } from "../src/config/env-parse.js";

const silent = () => { const o = console.error; console.error = () => {}; return () => { console.error = o; }; };
const IMG = Buffer.concat([Buffer.from("ffd8ffe000104a46494600010100", "hex"), Buffer.alloc(64, 1)]);
const META = JSON.parse(readFileSync(new URL("../../engine/models/kualitas_tanaman/metadata.json", import.meta.url), "utf8"));

const leafOut = (label, conf, second = 0.1) => ({
  label, label_id: META.labels_id[label] ?? label, confidence: conf, model: `${META.name}@${META.version}`,
  top3: [{ label, confidence: conf }, { label: "x", confidence: second }],
});
const geminiOk = { tanaman_terlihat: true, kondisi: "Daun sehat", kategori_kualitas: "baik", skor_kepercayaan: 0.9, masalah_terdeteksi: [] };
const gemini = (counter, out = geminiOk) => ({ name: "gemini", detect: async () => { counter.n++; return out; } });
const engine = (leaf) => createEngineProvider({ leaf, minMargin: 0.15 });
const svc = (provider, fallbackProvider = null) => createDetectionService({ provider, fallbackProvider, minConfidence: 0.5 });
const unavailable = () => { throw new HttpError(503, "Mesin prediksi tidak dapat dihubungi. Pastikan engine menyala."); };

describe("engine tidak tersedia dan fallback", () => {
  test("engine mati/timeout/model belum termuat -> ENGINE_UNAVAILABLE 503 berbahasa Indonesia, tanpa simulasi", async () => {
    const restore = silent();
    try {
      for (const msg of ["Mesin prediksi tidak dapat dihubungi. Pastikan engine menyala.", "Model belum dimuat di engine"]) {
        const leaf = async () => { throw new HttpError(503, msg); };
        await assert.rejects(svc(engine(leaf)).detect(IMG, "image/jpeg"), (e) => e.code === "ENGINE_UNAVAILABLE" && e.status === 503 && /tidak tersedia/.test(e.message));
      }
    } finally { restore(); }
  });

  test("tanpa fallback: Gemini tidak dipanggil (engine mati maupun keyakinan rendah)", async () => {
    const restore = silent();
    const g = { n: 0 }; // tidak ada provider Gemini terpasang; hitungan harus tetap 0
    try {
      await assert.rejects(svc(engine(async () => unavailable())).detect(IMG, "image/jpeg"), (e) => e.code === "ENGINE_UNAVAILABLE");
      const r = await svc(engine(async () => leafOut("cabai__healthy", 0.3, 0.2))).detect(IMG, "image/jpeg");
      assert.equal(r.status, "TIDAK_YAKIN");
      assert.equal(r.provider, "engine");
    } finally { restore(); }
    assert.equal(g.n, 0);
  });

  test("fallback gemini berjalan bila engine tidak tersedia (1 panggilan)", async () => {
    const restore = silent();
    const g = { n: 0 };
    try {
      const r = await svc(engine(async () => unavailable()), gemini(g)).detect(IMG, "image/jpeg");
      assert.equal(r.status, "SELESAI");
      assert.equal(r.provider, "gemini");
      assert.equal(r.sumber.fallback, true);
      assert.equal(g.n, 1);
    } finally { restore(); }
  });

  test("fallback berjalan sekali bila keyakinan rendah; hasil Gemini dipakai (bukan tanaman)", async () => {
    const g = { n: 0 };
    const r = await svc(engine(async () => leafOut("cabai__healthy", 0.3, 0.25)), gemini(g, { ...geminiOk, tanaman_terlihat: false, skor_kepercayaan: 0.1 })).detect(IMG, "image/jpeg");
    assert.equal(r.alasan, "bukan_tanaman");
    assert.equal(g.n, 1);
  });

  test("fallback tidak dipanggil bila engine yakin", async () => {
    const g = { n: 0 };
    const r = await svc(engine(async () => leafOut("cabai__healthy", 0.9, 0.05)), gemini(g)).detect(IMG, "image/jpeg");
    assert.equal(r.provider, "engine");
    assert.equal(g.n, 0);
  });

  test("galat selain engine-tidak-tersedia (kelas tak dikenal) tidak ditutupi fallback", async () => {
    const g = { n: 0 };
    await assert.rejects(svc(engine(async () => leafOut("jagung__rust", 0.9)), gemini(g)).detect(IMG, "image/jpeg"), (e) => e.code === "LEAF_CLASS_UNKNOWN");
    assert.equal(g.n, 0);
  });

  test("fallback gagal saat keyakinan rendah -> tetap TIDAK_YAKIN dari engine", async () => {
    const restore = silent();
    try {
      const bad = { name: "gemini", detect: async () => { throw new HttpError(503, "kuota"); } };
      const r = await svc(engine(async () => leafOut("cabai__healthy", 0.3, 0.25)), bad).detect(IMG, "image/jpeg");
      assert.equal(r.status, "TIDAK_YAKIN");
      assert.equal(r.provider, "engine");
    } finally { restore(); }
  });
});

describe("env", () => {
  test("bawaan: engine, fallback kosong; nilai tidak sah ditolak", () => {
    const base = { DATABASE_URL: "postgresql://x", JWT_SECRET: "a".repeat(32) };
    const e = buildEnv(base);
    assert.equal(e.detectionProvider, "engine");
    assert.equal(e.detectionFallbackProvider, "");
    assert.equal(e.detectionMinConfidence, 0.5);
    assert.equal(buildEnv({ ...base, DETECTION_PROVIDER: "gemini", DETECTION_FALLBACK_PROVIDER: "gemini" }).detectionProvider, "gemini");
    assert.throws(() => buildEnv({ ...base, DETECTION_MIN_MARGIN: "2" }), /DETECTION_MIN_MARGIN/);
  });
});
