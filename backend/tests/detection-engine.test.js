import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createDetectionService } from "../src/services/detection/index.js";
import { createEngineProvider, mapLeafResult } from "../src/services/detection/engine-provider.js";
import { LEAF_CLASS_MAP } from "../src/services/detection/leaf-class-map.js";
import { buildSolutionPrompt, generateSolution, ENGINE_COMMODITY_ASSUMPTION } from "../src/services/solution.service.js";
import { createPlantDetectionService } from "../src/services/plant-detection.service.js";
import { HttpError } from "../src/utils/http-error.js";
import { buildEnv } from "../src/config/env-parse.js";
import { makeFakeDb } from "./helpers/fake-detection-db.js";

const silent = () => { const o = console.error; console.error = () => {}; return () => { console.error = o; }; };
const IMG = Buffer.concat([Buffer.from("ffd8ffe000104a46494600010100", "hex"), Buffer.alloc(64, 1)]);
const META = JSON.parse(readFileSync(new URL("../../engine/models/kualitas_tanaman/metadata.json", import.meta.url), "utf8"));
const VERSI = `${META.name}@${META.version}`;

// keluaran engine palsu (bentuk sama dengan LeafArtifact.predict + "model")
const leafOut = (label, conf, second = 0.1) => ({
  label, label_id: META.labels_id[label] ?? label, confidence: conf, model: VERSI,
  top3: [{ label, confidence: conf }, { label: "x", confidence: second }],
});
const geminiOk = {
  tanaman_terlihat: true, kondisi: "Daun sehat", kategori_kualitas: "baik", skor_kepercayaan: 0.9, masalah_terdeteksi: [],
};
const gemini = (counter, out = geminiOk) => ({ name: "gemini", detect: async () => { counter.n++; return out; } });
const engine = (leaf) => createEngineProvider({ leaf, minMargin: 0.15 });
const svc = (provider, fallbackProvider = null) => createDetectionService({ provider, fallbackProvider, minConfidence: 0.5 });
const unavailable = () => { throw new HttpError(503, "Mesin prediksi tidak dapat dihubungi. Pastikan engine menyala."); };

describe("pemetaan kelas", () => {
  test("semua kelas di metadata.json punya entri, dan tidak ada entri berlebih", () => {
    assert.deepEqual(Object.keys(LEAF_CLASS_MAP).sort(), [...META.classes].sort());
    for (const c of META.classes) {
      const e = LEAF_CLASS_MAP[c];
      assert.ok(["baik", "sedang", "buruk"].includes(e.kategori_kualitas), c);
      assert.equal(c.startsWith(`${e.crop}__`), true, c);
      if (e.masalah) assert.ok(["hama", "penyakit", "defisiensi_nutrisi", "cekaman_air", "lainnya"].includes(e.masalah.jenis), c);
      else assert.equal(e.kategori_kualitas, "baik", c); // tanpa masalah = sehat
    }
  });

  test("kelas tak dikenal -> error jelas, bukan tebakan", () => {
    assert.throws(() => mapLeafResult(leafOut("jagung__rust", 0.9)), (e) => e.code === "LEAF_CLASS_UNKNOWN" && /jagung__rust/.test(e.message));
    assert.throws(() => mapLeafResult({ confidence: 0.9 }), (e) => e.code === "LEAF_CLASS_UNKNOWN");
    assert.throws(() => mapLeafResult(leafOut("toString", 0.9)), (e) => e.code === "LEAF_CLASS_UNKNOWN");
  });

  test("format hasil: keparahan 'sedang' ditandai perkiraan, sehat tanpa masalah, versi model ikut", async () => {
    const sick = await svc(engine(async () => leafOut("cabai__cercospora", 0.9))).detect(IMG, "image/jpeg");
    assert.equal(sick.status, "SELESAI");
    assert.equal(sick.provider, "engine");
    assert.equal(sick.hasil.masalah_terdeteksi[0].jenis, "penyakit");
    assert.equal(sick.hasil.masalah_terdeteksi[0].tingkat_keparahan, "sedang");
    assert.match(sick.hasil.kondisi, /perkiraan/);
    assert.equal(sick.sumber.model_versi, VERSI);
    assert.equal(sick.sumber.fallback, false);
    assert.equal("_meta" in sick.hasil, false);

    const ok = await svc(engine(async () => leafOut("tomat__health", 0.95))).detect(IMG, "image/jpeg");
    assert.equal(ok.hasil.kategori_kualitas, "baik");
    assert.deepEqual(ok.hasil.masalah_terdeteksi, []);
  });
});

describe("ambang keyakinan dan margin", () => {
  test("skor rendah -> TIDAK_YAKIN keyakinan_rendah", async () => {
    const r = await svc(engine(async () => leafOut("cabai__healthy", 0.4, 0.05))).detect(IMG, "image/jpeg");
    assert.equal(r.status, "TIDAK_YAKIN");
    assert.equal(r.alasan, "keyakinan_rendah");
  });
  test("margin tipis walau skor di atas ambang -> TIDAK_YAKIN", async () => {
    const r = await svc(engine(async () => leafOut("cabai__healthy", 0.55, 0.5))).detect(IMG, "image/jpeg");
    assert.equal(r.status, "TIDAK_YAKIN");
    assert.equal(r.alasan, "keyakinan_rendah");
  });
  test("margin cukup -> SELESAI", async () => {
    const r = await svc(engine(async () => leafOut("cabai__healthy", 0.7, 0.2))).detect(IMG, "image/jpeg");
    assert.equal(r.status, "SELESAI");
  });
});
