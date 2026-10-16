import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { generateSolution } from "../src/services/solution.service.js";
import { createGeminiProvider } from "../src/services/detection/gemini-provider.js";
import { buildSystemPrompt, langMarker } from "../src/services/rag/prompt.js";
import { assistantUserText } from "../src/services/lang-rule.js";

const RULES = {
  id: "Tulis SELURUH jawaban dalam Bahasa Indonesia.",
  en: "Write the ENTIRE response in English, even though the context below is in Indonesian.",
  zh: "请用简体中文撰写全部回答，即使下面的资料是印尼语。",
};
const count = (s, sub) => s.split(sub).length - 1;
const starts = (s, sub) => s.trimStart().startsWith(sub);
// aturan penutup = kalimat dasar + catatan JSON (deteksi/solusi), jadi cek bahwa ia ada di ujung teks
const ends = (s, sub) => s.lastIndexOf(sub) >= s.length - sub.length - 200;

const solOk = {
  ringkasan: "r", kemungkinan_penyebab: [], langkah_penanganan: [{ urutan: 1, langkah: "x", prioritas: "segera" }],
  bahan_dan_alat: [{ nama: "A", dosis_atau_jumlah: "1", estimasi_biaya_min: 1000, estimasi_biaya_max: 2000 }],
  estimasi_total_biaya: { min: 1000, max: 2000, per_hektar_atau_per_lahan: "x", asumsi: ["a"] },
  risiko_jika_tidak_ditangani: "r", pencegahan: [], kapan_konsultasi_ahli: "k",
};
const detOk = { tanaman_terlihat: true, kondisi: "k", kategori_kualitas: "baik", skor_kepercayaan: 0.9, masalah_terdeteksi: [] };
const fake = (reply) => { const calls = []; return { calls, models: { async generateContent(a) { calls.push(a); return { text: JSON.stringify(reply) }; } } }; };
const detection = { kondisi: "k", kategori_kualitas: "sedang", skor_kepercayaan: 0.8, masalah_terdeteksi: [] };

function checkJsonCall(call, rule) {
  const userText = call.contents[0].parts.find((p) => p.text)?.text ?? call.contents[0].parts[0].text;
  assert.ok(count(call.config.systemInstruction, rule) >= 1, "system memuat aturan");
  assert.ok(starts(call.config.systemInstruction, rule), "system diawali aturan");
  assert.ok(starts(userText, rule), "userText diawali aturan");
  assert.ok(ends(userText, rule), "userText diakhiri aturan");
  assert.match(call.config.systemInstruction, /bukan kunci JSON|not the JSON keys|不是 JSON 键/);
}

describe("instruksi bahasa output di semua prompt Gemini", () => {
  for (const lang of ["id", "en", "zh"]) {
    test(`solusi (${lang})`, async () => {
      const client = fake(solOk);
      await generateSolution({ detection, land: { komoditas: "cabai" }, lang }, { client, retrieveFn: async () => [], weatherFn: async () => null });
      const call = client.calls[0];
      checkJsonCall(call, RULES[lang]);
      assert.doesNotMatch(call.config.systemInstruction, /"per hektar"|"per lahan"/);
    });
    test(`deteksi Gemini (${lang})`, async () => {
      const client = fake(detOk);
      await createGeminiProvider({ client }).detect(Buffer.from("x"), "image/jpeg", { lang });
      checkJsonCall(client.calls[0], RULES[lang]);
    });
    test(`asisten (${lang})`, () => {
      const system = buildSystemPrompt({ chunks: [], farmerText: "t", lang });
      const userText = assistantUserText("halo", lang, langMarker(lang));
      assert.ok(starts(system, RULES[lang]) && ends(system, RULES[lang]));
      assert.ok(starts(userText, RULES[lang]) && ends(userText, RULES[lang]));
      assert.match(userText, /halo/);
    });
  }
  test("bahasa kosong/tidak dikenal -> id", async () => {
    for (const lang of [undefined, "", "fr", "__proto__"]) {
      const client = fake(solOk);
      await generateSolution({ detection, land: {}, lang }, { client, retrieveFn: async () => [], weatherFn: async () => null });
      checkJsonCall(client.calls[0], RULES.id);
    }
    assert.ok(starts(assistantUserText("x", "fr", ""), RULES.id));
  });
});
