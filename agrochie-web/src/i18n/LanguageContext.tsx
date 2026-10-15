'use client';
/**
 * LanguageContext — menyediakan bahasa aktif dan fungsi ganti bahasa ke seluruh aplikasi.
 *
 * Penggunaan:
 *   const { t, lang, setLang } = useTranslation();
 *   <p>{t.nav.beranda}</p>
 *
 * Bahasa disimpan di localStorage dengan key 'agrochie_lang'.
 * Perubahan bahasa langsung berlaku tanpa reload halaman.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { translations, type Lang, type Translations, LANG_OPTIONS } from './translations';

const STORAGE_KEY = 'agrochie_lang';
const DEFAULT_LANG: Lang = 'id';

// ── Deteksi bahasa awal (localStorage → browser → default) ──────────────────
function detectInitialLang(): Lang {
  if (typeof window === 'undefined') return DEFAULT_LANG;
  const stored = localStorage.getItem(STORAGE_KEY) as Lang | null;
  if (stored && (stored === 'id' || stored === 'en' || stored === 'zh')) return stored;
  const browser = navigator.language.slice(0, 2).toLowerCase();
  if (browser === 'en') return 'en';
  if (browser === 'zh') return 'zh';
  return DEFAULT_LANG;
}

// ── Context types ─────────────────────────────────────────────────────────────
interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  // Inisialisasi dari localStorage hanya di client
  useEffect(() => {
    setLangState(detectInitialLang());
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    localStorage.setItem(STORAGE_KEY, next);
    // Update atribut lang di <html> agar screen reader & font rendering benar
    document.documentElement.lang = next === 'zh' ? 'zh-CN' : next;
  }, []);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: translations[lang] }}>
      {children}
    </LanguageContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useTranslation() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useTranslation must be used inside <LanguageProvider>');
  return ctx;
}

// Re-export untuk kemudahan
export type { Lang, Translations };
export { LANG_OPTIONS };
