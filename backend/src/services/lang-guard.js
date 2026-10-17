// [REVISI] Pengaman bahasa keluaran Gemini. Fungsi murni + pembungkus "ulang sekali".
// Log hanya kode kejadian (tanpa isi teks).
import { normalizeLang } from "./lang-rule.js";

// ── Ambang (heuristik; sengaja longgar agar nama diri/istilah teknis tidak memicu ulang) ──
// zh: skor = kata Latin / (kata Latin + huruf Han / 2). Salah bila skor >= 0.12 DAN kata Latin >= 5.
//     (nama zat aktif/merek berhuruf kecil dalam jumlah kecil, mis. 3 kata dalam 200 huruf Han = 0.03, lolos.)
// en: skor = kata Indonesia umum / semua kata Latin. Salah bila (hit >= 3 dan skor >= 0.05) atau (hit >= 2 dan skor >= 0.15).
export const ZH_MIN_LATIN = 5;
export const ZH_RATIO = 0.12;
export const EN_RATIO_A = 0.05;
export const EN_RATIO_B = 0.15;

// Kata yang tidak dihitung sebagai bahasa salah: merek dan satuan umum (huruf kecil).
const ALWAYS_PROTECTED = ["agrochie", "kg", "g", "ml", "l", "ha", "cm", "mm", "m", "rp", "jt", "npk", "ph", "ec", "ppm", "wib", "cnn", "ai", "gemini", "urea", "sp", "kcl", "za"];

// Kata Indonesia umum yang tidak ambigu dengan bahasa Inggris.
const ID_WORDS = new Set(["dan", "yang", "untuk", "dengan", "tidak", "tanaman", "lahan", "petani", "penanganan", "adalah", "pada", "dari", "atau", "jika", "akan", "dapat", "bisa", "sebaiknya", "sebelum", "setelah", "karena", "dalam", "juga", "sudah", "belum", "perlu", "gunakan", "lakukan", "daun", "buah", "hama", "penyakit", "pupuk", "musim", "biaya", "kurang", "terlalu", "agar", "saat", "oleh", "sangat", "masih", "satu", "kami", "anda", "silakan", "terima", "kasih", "tanah", "air", "hasil", "panen"]);

/** Hilangkan teks dalam kurung dan teks yang dilindungi (nama lahan, desa, provinsi, negara, dst.). */
function clean(text, protect = []) {
  let s = String(text ?? "").replace(/[(（][^)）]*[)）]/g, " ").replace(/https?:\/\/\S+/g, " ");
  for (const p of protect) {
    const v = String(p ?? "").trim();
    if (v.length >= 2) s = s.split(new RegExp(v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")).join(" ");
  }
  return s;
}

/** Kata Latin yang dihitung: bukan nama diri (awalan huruf besar), bukan singkatan HURUF BESAR, bukan merek/satuan. */
function latinWords(s, { skipCapitalized }) {
  const out = [];
  for (const w of s.match(/[A-Za-z][A-Za-z'-]*/g) ?? []) {
    if (w.length < 2) continue;
    if (w === w.toUpperCase()) continue; // singkatan/merek
    if (skipCapitalized && /^[A-Z]/.test(w)) continue; // nama diri
    if (ALWAYS_PROTECTED.includes(w.toLowerCase())) continue;
    out.push(w);
  }
  return out;
}

/** { score, mismatch } untuk satu teks. Bahasa id tidak pernah dianggap salah. */
export function languageMismatch(text, lang, { protect = [] } = {}) {
  const l = normalizeLang(lang);
  if (l === "id") return { score: 0, mismatch: false };
  const s = clean(text, protect);
  if (l === "zh") {
    const han = (s.match(/\p{Script=Han}/gu) ?? []).length;
    const latin = latinWords(s, { skipCapitalized: true }).length;
    const score = latin / (latin + han / 2 || 1);
    return { score, mismatch: latin >= ZH_MIN_LATIN && score >= ZH_RATIO };
  }
  const words = latinWords(s, { skipCapitalized: false });
  const hits = words.filter((w) => ID_WORDS.has(w.toLowerCase())).length;
  const score = words.length ? hits / words.length : 0;
  return { score, mismatch: (hits >= 3 && score >= EN_RATIO_A) || (hits >= 2 && score >= EN_RATIO_B) };
}

/** true bila teks (atau semua nilai teks sebuah objek JSON) memakai bahasa yang salah untuk `lang`. */
export function detectLanguageMismatch(textOrObject, lang, opts) {
  return languageMismatch(collectText(textOrObject), lang, opts).mismatch;
}

/** Semua NILAI teks (bukan kunci) dari objek/array; string bergaya enum (a-z, 0-9, _) dilewati. */
export function collectText(value) {
  const out = [];
  const walk = (v) => {
    if (typeof v === "string") { if (!/^[a-z0-9_]+$/.test(v)) out.push(v); }
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(value);
  return out.join("\n");
}

/**
 * Jalankan run(false); bila bahasa salah, ulang SEKALI dengan run(true) (instruksi lebih tegas).
 * Bila masih salah, kembalikan yang skor salahnya terkecil. Gagal pada percobaan ulang -> hasil pertama dipakai.
 * Log hanya kode: LANG_MISMATCH_RETRY, LANG_RETRY_FAILED, LANG_MISMATCH_PERSIST.
 */
export async function withLanguageGuard({ lang, run, protect = [], label = "ai", log = (code) => console.error(`[lang-guard] ${code} ${label}`) }) {
  const first = await run(false);
  const m1 = languageMismatch(collectText(first), lang, { protect });
  if (!m1.mismatch) return first;
  log("LANG_MISMATCH_RETRY");
  let second;
  try { second = await run(true); } catch { log("LANG_RETRY_FAILED"); return first; }
  const m2 = languageMismatch(collectText(second), lang, { protect });
  if (!m2.mismatch) return second;
  log("LANG_MISMATCH_PERSIST");
  return m2.score < m1.score ? second : first;
}
