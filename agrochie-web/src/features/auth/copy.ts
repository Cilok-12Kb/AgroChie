/**
 * Pembacaan bahasa di luar komponen React, terutama untuk payload API.
 * Teks antarmuka berada di `src/i18n/translations.ts` dan diakses lewat useTranslation().
 */

/** Bahasa yang didukung: Bahasa Indonesia, English, Mandarin (中文). */
export type Lang = 'id' | 'en' | 'zh';

/** Membaca bahasa aktif dengan urutan yang sama seperti LanguageProvider. */
export function currentLang(): Lang {
  if (typeof window === 'undefined') return 'id';
  const stored = localStorage.getItem('agrochie_lang') as Lang | null;
  if (stored === 'id' || stored === 'en' || stored === 'zh') return stored;
  const browser = navigator.language.slice(0, 2).toLowerCase();
  if (browser === 'en' || browser === 'zh') return browser;
  return 'id';
}