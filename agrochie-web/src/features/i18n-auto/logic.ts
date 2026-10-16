// Fungsi murni untuk penerjemah otomatis saat tampil (tanpa DOM, tanpa import) agar mudah diuji dengan node --test.
// Hanya sintaks TypeScript yang dapat dihapus (erasable): tanpa enum / parameter property.

export type TargetLang = 'en' | 'zh';

export const MAX_BATCH_TEXTS = 50;
export const MAX_TEXT_CHARS = 500;
export const MAX_BATCH_CHARS = 10_000;

/** Atribut yang ikut diterjemahkan selain text node. */
export const TRANSLATABLE_ATTRS = ['placeholder', 'title', 'aria-label', 'alt'] as const;

/** Elemen yang isinya tidak pernah diterjemahkan (huruf besar, sesuai Element.tagName). */
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'NOSCRIPT', 'TEXTAREA', 'INPUT']);
export const isSkippedTag = (tagName: string) => SKIP_TAGS.has(tagName.toUpperCase());

/**
 * [REVISI] <option> tanpa atribut value mengirim teksnya sebagai nilai form, jadi teks itu tidak boleh diterjemahkan.
 * <option value="x">label</option> tetap diterjemahkan (yang dikirim adalah value, bukan label).
 */
export const isValuelessOption = (tagName: string, hasValueAttr: boolean) =>
  tagName.toUpperCase() === 'OPTION' && !hasValueAttr;

/** Selektor elemen yang (beserta turunannya) dilewati. */
export const NO_TRANSLATE_SELECTOR = '[data-no-translate],[translate="no"]';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_LIKE = /^(https?:\/\/|www\.)\S+$/i;
const PHONE = /^\+?[\d\s().-]{7,}$/;
const CURRENCY = /^(rp\.?\s*)?[\d.,\s]+(\s*(jt|juta|rb|ribu))?$/i;
const DATE_ISO = /^\d{4}-\d{2}-\d{2}([T\s][\d:.]+Z?)?$/;
const DATE_NAMED = /^\d{1,2}\s+\p{L}{3,9}\.?,?\s+\d{4}$/u;
const HAN = /\p{Script=Han}/u;
const LETTER = /\p{L}/u;

/** Kunci dalam daftar teks: spasi dirapatkan dan dipangkas. Spasi awal/akhir dikembalikan oleh rewrap(). */
export const normalizeKey = (value: string) => value.replace(/\s+/g, ' ').trim();

/** Pasang kembali spasi awal/akhir asli pada hasil terjemahan. */
export function rewrap(original: string, translated: string) {
  const lead = original.match(/^\s*/)?.[0] ?? '';
  const trail = original.match(/\s*$/)?.[0] ?? '';
  return `${lead}${translated}${trail}`;
}

/**
 * Apakah teks (sudah dinormalisasi) dilewati: kosong, tanpa huruf (angka/simbol/persen/tanggal angka),
 * mata uang, tanggal, email, nomor HP, URL, terlalu panjang, atau sudah beraksara Mandarin saat target zh.
 */
export function shouldSkipText(text: string, target: TargetLang) {
  const t = text.trim();
  if (t.length < 2 || t.length > MAX_TEXT_CHARS) return true;
  if (!LETTER.test(t)) return true;
  if (EMAIL.test(t) || URL_LIKE.test(t) || PHONE.test(t)) return true;
  if (CURRENCY.test(t) || DATE_ISO.test(t) || DATE_NAMED.test(t)) return true;
  if (target === 'zh' && HAN.test(t)) return true;
  return false;
}

/**
 * Pecah daftar teks menjadi batch: unik, tiap batch maksimal 50 teks dan 10.000 karakter total;
 * teks lebih panjang dari 500 karakter dibuang (backend akan menolaknya).
 */
export function chunkBatches(texts: string[], opts: { maxTexts?: number; maxChars?: number; maxTextChars?: number } = {}) {
  const maxTexts = opts.maxTexts ?? MAX_BATCH_TEXTS;
  const maxChars = opts.maxChars ?? MAX_BATCH_CHARS;
  const maxTextChars = opts.maxTextChars ?? MAX_TEXT_CHARS;
  const batches: string[][] = [];
  let current: string[] = [];
  let chars = 0;
  for (const text of new Set(texts)) {
    if (!text || text.length > maxTextChars) continue;
    if (current.length >= maxTexts || chars + text.length > maxChars) {
      batches.push(current);
      current = [];
      chars = 0;
    }
    current.push(text);
    chars += text.length;
  }
  if (current.length) batches.push(current);
  return batches;
}

/** Kunci cache memori: terpisah per bahasa. */
export const cacheKey = (lang: string, text: string) => `${lang}\u0000${text}`;

/** Kunci localStorage: satu entri per bahasa. */
export const storageKey = (lang: string) => `agrochie_autotr_v1_${lang}`;

export const MIN_PROTECTED_CHARS = 3;

/** Daftar teks dilindungi (nama akun/lahan): dipangkas, huruf kecil, unik; kosong atau < 3 karakter diabaikan. */
export function buildProtected(names: ReadonlyArray<string | null | undefined>) {
  const out = new Set<string>();
  for (const n of names) {
    const v = typeof n === 'string' ? n.replace(/\s+/g, ' ').trim().toLowerCase() : '';
    if (v.length >= MIN_PROTECTED_CHARS) out.add(v);
  }
  return [...out];
}

/** Apakah teks memuat salah satu teks dilindungi (tidak peka huruf besar/kecil). Teks itu tidak boleh dikirim atau disimpan. */
export function containsProtected(text: string, protectedList: ReadonlyArray<string>) {
  if (!protectedList.length) return false;
  const t = text.toLowerCase();
  return protectedList.some((p) => p.length >= MIN_PROTECTED_CHARS && t.includes(p));
}

