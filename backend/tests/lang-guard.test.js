import { test } from "node:test";
import assert from "node:assert/strict";
import { detectLanguageMismatch, withLanguageGuard, languageMismatch } from "../src/services/lang-guard.js";
import { generateAnswer } from "../src/services/llm.service.js";
import { withStrictLanguage } from "../src/services/lang-rule.js";

const ZH_OK = "请先清除病叶，然后在早晨喷洒适量的杀菌剂。保持田间通风，避免叶面长时间潮湿，并在一周后再次检查。";
const ZH_MIX = "请先清除 病叶 and then lakukan penanganan untuk tanaman yang tidak sehat dengan segera, gunakan pupuk dan air yang cukup untuk lahan petani.";
const EN_OK = "Remove the affected leaves and apply a suitable fungicide in the morning. Keep the field ventilated.";
const EN_MIX = "Remove the leaves dan lakukan penanganan untuk tanaman yang sakit dengan segera.";

test("deteksi: zh bersih tidak salah; zh tercampur salah", () => {
  assert.equal(detectLanguageMismatch(ZH_OK, "zh"), false);
  assert.equal(detectLanguageMismatch(ZH_MIX, "zh"), true);
});
test("deteksi: en bersih tidak salah; en tercampur Indonesia salah", () => {
  assert.equal(detectLanguageMismatch(EN_OK, "en"), false);
  assert.equal(detectLanguageMismatch(EN_MIX, "en"), true);
});
test("bahasa id tidak pernah dianggap salah", () => assert.equal(detectLanguageMismatch(EN_MIX, "id"), false));
test("nama diri, merek, satuan, angka, dan teks dalam kurung tidak dihitung (zh)", () => {
  const t = "在 Lahan Sari Desa Cibodas Jawa Barat 的田地使用 AgroChie 建议，施用 NPK 50 kg 和 Mancozeb (fungisida kontak dengan bahan aktif) 防治病害，并清除病叶。";
  assert.equal(detectLanguageMismatch(t, "zh"), false);
});
test("nama lahan yang dilindungi tidak dihitung walau berisi kata Indonesia (en)", () => {
  const t = "Check the field Tanaman Lahan Petani Dan Yang daily.";
  assert.equal(detectLanguageMismatch(t, "en", { protect: ["Tanaman Lahan Petani Dan Yang"] }), false);
});
test("JSON solusi: semua nilai teks diperiksa, kunci dan enum diabaikan", () => {
  const ok = { ringkasan: EN_OK, langkah_penanganan: [{ urutan: 1, langkah: EN_OK, prioritas: "minggu_ini" }], pencegahan: [EN_OK] };
  assert.equal(detectLanguageMismatch(ok, "en"), false);
  const bad = { ringkasan: EN_OK, pencegahan: [EN_MIX], kapan_konsultasi_ahli: EN_MIX };
  assert.equal(detectLanguageMismatch(bad, "en"), true);
});

const log = () => { const codes = []; return { codes, fn: (c) => codes.push(c) }; };

test("guard: jawaban benar tidak memicu ulang", async () => {
  let n = 0; const l = log();
  const r = await withLanguageGuard({ lang: "zh", log: l.fn, run: async () => { n++; return ZH_OK; } });
  assert.equal(r, ZH_OK); assert.equal(n, 1); assert.deepEqual(l.codes, []);
});
test("guard: jawaban tercampur memicu tepat satu ulang dan memakai hasil benar", async () => {
  const seen = []; const l = log();
  const r = await withLanguageGuard({ lang: "zh", log: l.fn, run: async (strict) => { seen.push(strict); return strict ? ZH_OK : ZH_MIX; } });
  assert.equal(r, ZH_OK); assert.deepEqual(seen, [false, true]); assert.deepEqual(l.codes, ["LANG_MISMATCH_RETRY"]);
});
test("guard: batas satu kali ulang; bila tetap salah, ambil yang skor salahnya terkecil", async () => {
  const worse = "请 and then lakukan penanganan untuk tanaman yang tidak sehat dengan segera, gunakan pupuk dan air untuk lahan petani yang luas dengan baik.";
  assert.ok(languageMismatch(worse, "zh").score > languageMismatch(ZH_MIX, "zh").score);
  let n = 0; const l = log();
  const r = await withLanguageGuard({ lang: "zh", log: l.fn, run: async (strict) => { n++; return strict ? ZH_MIX : worse; } });
  assert.equal(n, 2); assert.equal(r, ZH_MIX);
  assert.deepEqual(l.codes, ["LANG_MISMATCH_RETRY", "LANG_MISMATCH_PERSIST"]);
});
test("guard: ulang gagal -> hasil pertama dipakai, tidak gagal total", async () => {
  const l = log();
  const r = await withLanguageGuard({ lang: "zh", log: l.fn, run: async (strict) => { if (strict) throw new Error("x"); return ZH_MIX; } });
  assert.equal(r, ZH_MIX); assert.deepEqual(l.codes, ["LANG_MISMATCH_RETRY", "LANG_RETRY_FAILED"]);
});
test("log default hanya kode kejadian, tanpa isi teks", async () => {
  const logs = []; const orig = console.error; console.error = (...a) => logs.push(a.join(" "));
  try { await withLanguageGuard({ lang: "zh", run: async (s) => (s ? ZH_MIX : ZH_MIX) }); } finally { console.error = orig; }
  assert.ok(logs.length >= 1);
  for (const x of logs) { assert.match(x, /^\[lang-guard\] LANG_[A-Z_]+ ai$/); assert.ok(!x.includes("penanganan")); }
});

test("Gemini tiruan: model cadangan menerima instruksi bahasa yang sama (strict) dan temperature rendah", async () => {
  const calls = [];
  const client = { models: { generateContent: async (req) => {
    calls.push(req);
    if (req.model === "m-utama") throw Object.assign(new Error("busy"), { status: 429 });
    return { text: calls.length > 2 ? ZH_OK : ZH_MIX };
  } } };
  const cfg = { geminiModel: "m-utama", geminiFallbackModel: "m-cadangan", geminiMaxRetries: 0, geminiRetryBaseMs: 1, geminiTimeoutMs: 30000 };
  const base = "pertanyaan";
  const orig = console.error; console.error = () => {};
  try {
    const r = await withLanguageGuard({ lang: "zh", log: () => {}, run: (strict) => generateAnswer({ system: "SISTEM zh 请用简体中文", history: [], userText: strict ? withStrictLanguage(base, "zh") : base, temperature: 0.3 }, client, { cfg, sleep: async () => {} }) });
    assert.equal(r, ZH_OK);
  } finally { console.error = orig; }
  const fb = calls.filter((c) => c.model === "m-cadangan");
  assert.equal(fb.length, 2);
  assert.ok(fb.every((c) => c.config.systemInstruction.includes("简体中文") && c.config.temperature === 0.3));
  assert.ok(fb[1].contents.at(-1).parts[0].text.startsWith("警告"));
  assert.ok(fb[1].contents.at(-1).parts[0].text.trimEnd().endsWith("Chinese.)"));
});
