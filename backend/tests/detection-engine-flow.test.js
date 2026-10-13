import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createDetectionService } from "../src/services/detection/index.js";
import { createEngineProvider } from "../src/services/detection/engine-provider.js";
import { createPlantDetectionService } from "../src/services/plant-detection.service.js";
import { HttpError } from "../src/utils/http-error.js";
import { makeFakeDb } from "./helpers/fake-detection-db.js";

const silent = () => { const o = console.error; console.error = () => {}; return () => { console.error = o; }; };
const IMG = Buffer.concat([Buffer.from("ffd8ffe000104a46494600010100", "hex"), Buffer.alloc(64, 1)]);
const META = JSON.parse(readFileSync(new URL("../../engine/models/kualitas_tanaman/metadata.json", import.meta.url), "utf8"));
const VERSI = `${META.name}@${META.version}`;
const leafOut = (label, conf, second = 0.1) => ({
  label, label_id: META.labels_id[label] ?? label, confidence: conf, model: VERSI,
  top3: [{ label, confidence: conf }, { label: "x", confidence: second }],
});
const engine = (leaf) => createEngineProvider({ leaf, minMargin: 0.15 });
const unavailable = () => { throw new HttpError(503, "Mesin prediksi tidak dapat dihubungi. Pastikan engine menyala."); };

describe("alur lengkap: engine + solusi", () => {
  function setup(leaf, fallback = null) {
    const db = makeFakeDb({ farms: [{ id: "f1", userId: "u1" }], seasons: [{ id: "s1", farmId: "f1", crop: "CABAI", areaHa: 1, status: "TANAM", plantedOn: new Date("2026-09-01") }] });
    const calls = { solve: 0, solveArgs: null };
    const s = createPlantDetectionService({
      db,
      detector: createDetectionService({ provider: engine(leaf), fallbackProvider: fallback, minConfidence: 0.5 }),
      solver: { generate: async (a) => { calls.solve++; calls.solveArgs = a; return { estimasi_total_biaya: { min: 1000, max: 2000 }, bahan_dan_alat: [] }; } },
      storage: { save: async () => "k.jpg", read: async () => IMG, remove: async () => {} },
      config: { detectionMaxBytes: 1024 },
      now: () => new Date("2026-10-13T03:00:00Z"),
    });
    return { db, s, calls };
  }
  const run = (s) => s.create({ userId: "u1", file: { buffer: IMG, size: IMG.length, mimetype: "image/jpeg" }, lahanId: "f1", catatan: null });

  test("engine yakin tanpa fallback: solusi dipanggil 1x dengan sumber engine; provider+versi tersimpan di riwayat", async () => {
    const { s, calls, db } = setup(async () => leafOut("cabai__cercospora", 0.9));
    const r = await run(s);
    assert.equal(calls.solve, 1);
    assert.equal(calls.solveArgs.sumber.provider, "engine");
    assert.equal(calls.solveArgs.sumber.model_versi, VERSI);
    assert.equal(r.provider, "engine");
    assert.deepEqual(r.sumber_deteksi, { provider: "engine", model_versi: VERSI });
    assert.equal(db.detections[0].detection.sumber.kelas, "cabai__cercospora");
  });

  test("TIDAK_YAKIN: solusi tidak dipanggil", async () => {
    const { s, calls } = setup(async () => leafOut("cabai__healthy", 0.3, 0.25));
    const r = await run(s);
    assert.equal(r.status, "TIDAK_YAKIN");
    assert.equal(calls.solve, 0);
  });

  test("engine mati: ENGINE_UNAVAILABLE, tanpa solusi, tidak ada data tersimpan", async () => {
    const restore = silent();
    try {
      const { s, calls, db } = setup(async () => unavailable());
      await assert.rejects(run(s), (e) => e.code === "ENGINE_UNAVAILABLE" && e.status === 503);
      assert.equal(calls.solve, 0);
      assert.equal(db.detections.length, 0);
    } finally { restore(); }
  });

  test("engine mati + fallback gemini: deteksi 1x lalu solusi 1x dengan sumber fallback", async () => {
    const restore = silent();
    try {
      const g = { n: 0 };
      const fb = { name: "gemini", detect: async () => { g.n++; return { tanaman_terlihat: true, kondisi: "k", kategori_kualitas: "baik", skor_kepercayaan: 0.9, masalah_terdeteksi: [] }; } };
      const { s, calls } = setup(async () => unavailable(), fb);
      const r = await run(s);
      assert.equal(r.provider, "gemini");
      assert.equal(g.n, 1);
      assert.equal(calls.solve, 1);
      assert.equal(calls.solveArgs.sumber.fallback, true);
    } finally { restore(); }
  });
});
