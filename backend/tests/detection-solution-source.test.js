import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildSolutionPrompt, generateSolution, ENGINE_COMMODITY_ASSUMPTION } from "../src/services/solution.service.js";

const META = JSON.parse(readFileSync(new URL("../../engine/models/kualitas_tanaman/metadata.json", import.meta.url), "utf8"));
const VERSI = `${META.name}@${META.version}`;

describe("solusi menerima sumber deteksi", () => {
  const detection = { kondisi: "k", kategori_kualitas: "sedang", skor_kepercayaan: 0.8, masalah_terdeteksi: [] };
  const sumber = { provider: "engine", model_versi: VERSI, komoditas_model: "cabai" };

  test("prompt menyebut model internal, kelas terbatas, versi, dan ketidakpastian", () => {
    const p = buildSolutionPrompt({ detection, land: { komoditas: "cabai" }, sumber });
    assert.match(p, /model klasifikasi daun internal/);
    assert.match(p, /kelas terbatas/);
    assert.match(p, new RegExp(VERSI));
    assert.match(p, /ketidakpastian/);
    assert.doesNotMatch(p, /PERINGATAN/);
  });
  test("komoditas lahan di luar yang dilatih (bawang) -> peringatan di prompt", () => {
    assert.match(buildSolutionPrompt({ detection, land: { komoditas: "bawang" }, sumber }), /PERINGATAN/);
  });
  test("tanpa sumber engine, prompt tidak memuat catatan model internal", () => {
    assert.doesNotMatch(buildSolutionPrompt({ detection, land: { komoditas: "cabai" } }), /model klasifikasi daun internal/);
  });

  const solOk = {
    ringkasan: "r", kemungkinan_penyebab: [], langkah_penanganan: [{ urutan: 1, langkah: "x", prioritas: "segera" }],
    bahan_dan_alat: [{ nama: "A", dosis_atau_jumlah: "1", estimasi_biaya_min: 1000, estimasi_biaya_max: 2000 }],
    estimasi_total_biaya: { min: 1000, max: 2000, per_hektar_atau_per_lahan: "per lahan", asumsi: ["a"] },
    risiko_jika_tidak_ditangani: "r", pencegahan: [], kapan_konsultasi_ahli: "k",
  };
  const fakeClient = () => { const calls = []; return { calls, models: { async generateContent(a) { calls.push(a); return { text: JSON.stringify(solOk) }; } } }; };
  const deps = (client) => ({ client, retrieveFn: async () => [], weatherFn: async () => null });

  test("generateSolution: 1 panggilan Gemini; komoditas berbeda ditandai di respons dan asumsi", async () => {
    const client = fakeClient();
    const r = await generateSolution({ detection, land: { komoditas: "bawang" }, sumber }, deps(client));
    assert.equal(client.calls.length, 1);
    assert.equal(r.deteksi_komoditas_berbeda, true);
    assert.ok(r.estimasi_total_biaya.asumsi.includes(ENGINE_COMMODITY_ASSUMPTION));
    assert.match(client.calls[0].contents[0].parts[0].text, /model klasifikasi daun internal/);
  });
  test("generateSolution: komoditas sama -> tidak ditandai", async () => {
    const r = await generateSolution({ detection, land: { komoditas: "cabai merah" }, sumber }, deps(fakeClient()));
    assert.equal(r.deteksi_komoditas_berbeda, false);
  });
});
