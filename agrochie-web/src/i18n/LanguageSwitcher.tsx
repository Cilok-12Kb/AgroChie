'use client';
/**
 * LanguageSwitcher — dropdown untuk memilih bahasa.
 *
 * Tampil sebagai tombol bulat di topbar dengan bendera bahasa aktif.
 * Dropdown muncul dengan animasi fade-in dan menutup jika klik di luar.
 */

import { useRef, useState, useEffect } from 'react';
import { Languages } from 'lucide-react';
import { useTranslation, LANG_OPTIONS, type Lang } from '@/i18n/LanguageContext';

export function LanguageSwitcher() {
  const { lang, setLang, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Tutup dropdown jika klik di luar
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Tutup jika tekan Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const active = LANG_OPTIONS.find(o => o.value === lang)!;

  const handleSelect = (value: Lang) => {
    setLang(value);
    setOpen(false);
  };

  return (
    <div ref={ref} className="lang-switcher-root" style={{ position: 'relative' }}>
      {/* ── Trigger button ── */}
      <button
        id="lang-switcher-btn"
        aria-label={t.shell.languageLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={t.shell.languageLabel}
        onClick={() => setOpen(v => !v)}
        className="lang-switcher-trigger console-circle-icon"
      >
        <span className="lang-switcher-flag" aria-hidden="true">{active.flag}</span>
        <Languages size={13} className="lang-switcher-icon" />
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div
          role="listbox"
          aria-label={t.shell.languageLabel}
          className="lang-switcher-dropdown"
        >
          {/* Header */}
          <div className="lang-switcher-header">
            <Languages size={13} />
            <span>{t.shell.languageLabel}</span>
          </div>

          {/* Options */}
          {LANG_OPTIONS.map(opt => {
            const isActive = opt.value === lang;
            return (
              <button
                key={opt.value}
                role="option"
                aria-selected={isActive}
                id={`lang-opt-${opt.value}`}
                onClick={() => handleSelect(opt.value)}
                className={`lang-switcher-option ${isActive ? 'lang-switcher-option-active' : ''}`}
              >
                <span className="lang-switcher-opt-flag">{opt.flag}</span>
                <span className="lang-switcher-opt-info">
                  <span className="lang-switcher-opt-native">{opt.nativeLabel}</span>
                  <span className="lang-switcher-opt-label">{opt.label}</span>
                </span>
                {isActive && (
                  <span className="lang-switcher-check" aria-hidden="true">✓</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
