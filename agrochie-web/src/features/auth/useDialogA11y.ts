'use client';
import { useEffect, useRef, type RefObject } from 'react';
import { trapFocusIndex } from './logic';

/** Aksesibilitas dialog: fokus awal, trap Tab, Escape, dan fokus kembali ke pemicu/tujuan pengganti. */
export function useDialogA11y(open: boolean, initialFocus: RefObject<HTMLElement | null> | null, onClose: () => void, fallbackFocus?: RefObject<HTMLElement | null>) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const fallback = fallbackFocus?.current ?? null;
    const focusables = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, iframe, [tabindex]') ?? [])
      .filter(el => !el.hasAttribute('disabled') && el.tabIndex >= 0 && el.getClientRects().length > 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); closeRef.current(); return; }
      if (e.key !== 'Tab') return;
      const list = focusables();
      const target = trapFocusIndex(list.length, list.indexOf(document.activeElement as HTMLElement), e.shiftKey);
      if (target === null) return;
      e.preventDefault();
      (target === -1 ? dialogRef.current : list[target])?.focus();
    };
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(() => (initialFocus?.current ?? dialogRef.current)?.focus());
    return () => {
      document.removeEventListener('keydown', onKey);
      if (trigger?.isConnected) trigger.focus();
      else fallback?.focus();
    };
  }, [open, initialFocus, fallbackFocus]);
  return dialogRef;
}
