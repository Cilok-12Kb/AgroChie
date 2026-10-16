// [REVISI] Instruksi bahasa output tegas untuk SEMUA prompt Gemini (solusi, deteksi, asisten).
// Dipasang di system DAN di awal serta akhir userText. Bahasa kosong/tidak dikenal -> id.
const BASE = {
  id: "Tulis SELURUH jawaban dalam Bahasa Indonesia.",
  en: "Write the ENTIRE response in English, even though the context below is in Indonesian.",
  zh: "请用简体中文撰写全部回答，即使下面的资料是印尼语。",
};
const JSON_NOTE = {
  id: "Semua nilai teks di JSON (bukan kunci JSON, bukan nilai enum) harus berbahasa Indonesia.",
  en: "Every text value in the JSON (not the JSON keys, not the enum values) must be in English.",
  zh: "JSON 中所有文本值（不是 JSON 键，也不是枚举值）都必须使用简体中文。",
};

export const normalizeLang = (lang) => (Object.hasOwn(BASE, lang) ? lang : "id");
/** Aturan untuk keluaran JSON (solusi, deteksi). */
export const outputLanguageRule = (lang) => { const l = normalizeLang(lang); return `${BASE[l]} ${JSON_NOTE[l]}`; };
/** Aturan untuk jawaban teks biasa (asisten). */
export const chatLanguageRule = (lang) => BASE[normalizeLang(lang)];

/** Tempel aturan di awal dan akhir teks pengguna. */
export const withLanguageRule = (text, lang, rule = outputLanguageRule) => `${rule(lang)}\n\n${text}\n\n${rule(lang)}`;

/** userText asisten: aturan bahasa di awal dan akhir, penanda bahasa di sebelum aturan akhir. */
export const assistantUserText = (text, lang, marker) => `${chatLanguageRule(lang)}\n\n${text}\n\n${marker}\n${chatLanguageRule(lang)}`;

