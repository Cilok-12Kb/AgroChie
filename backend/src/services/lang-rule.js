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

// [REVISI] percobaan ulang pengaman bahasa: peringatan tegas di awal dan akhir.
const STRICT = {
  id: "PERINGATAN: jawaban sebelumnya memakai bahasa yang salah; tulis ulang SELURUHNYA dalam Bahasa Indonesia.",
  en: "WARNING: the previous answer used the wrong language; rewrite it ENTIRELY in English. Do not use any Indonesian words.",
  zh: "警告：上一次的回答使用了错误的语言；请完全用简体中文重写全部内容，不要使用任何印尼语单词。(The previous answer used the wrong language; rewrite it ENTIRELY in Simplified Chinese.)",
};
export const strictLanguageNote = (lang) => STRICT[normalizeLang(lang)];
export const withStrictLanguage = (text, lang) => `${strictLanguageNote(lang)}\n\n${text}\n\n${strictLanguageNote(lang)}`;

