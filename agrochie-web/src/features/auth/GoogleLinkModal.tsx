'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError, type Account } from '../console/api';
import { Button, ErrorLine, Field, inputClass, Message } from '../console/ui';
import { GoogleButton } from './GoogleButton';
import { linkErrorOutcome, trapFocusIndex } from './logic';
import { SERVER_MSG } from './serverMessages';
import { useTranslation } from '../../i18n';

/**
 * Modal tautkan Google: langkah 1 kata sandi, langkah 2 tombol Google.
 * Kata sandi hanya di state lokal modal dan dikosongkan di finally; menutup modal mengosongkan semua state
 * (komponen ini hanya dipasang selama modal terbuka, jadi unmount = state hilang).
 */
export function GoogleLinkModal({ onClose, onLinked, onHide, onUnavailable, onCooldown }: {
  onClose: () => void;
  onLinked: (user: Account) => void;
  onHide: () => void; // 403
  onUnavailable: () => void; // 503
  onCooldown: () => void; // 429 (modal ditutup)
}) {
  const copy = useTranslation().t.auth;
  const [step, setStep] = useState<1 | 2>(1);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef(onClose);

  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => { closeRef.current = onClose; });
  // [REVISI] A4: Escape menutup; Tab/Shift+Tab ditahan di dalam dialog; fokus kembali ke pemicu saat modal ditutup.
  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusables = (): HTMLElement[] => {
      const root = dialogRef.current;
      if (!root) return [];
      return Array.from(root.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, iframe, [tabindex]'))
        .filter(el => !el.hasAttribute('disabled') && el.tabIndex >= 0 && el.getClientRects().length > 0);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { closeRef.current(); return; }
      if (e.key !== 'Tab') return;
      const list = focusables();
      const target = trapFocusIndex(list.length, list.indexOf(document.activeElement as HTMLElement), e.shiftKey);
      if (target === null) return;
      e.preventDefault();
      (target === -1 ? dialogRef.current : list[target])?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (trigger && trigger.isConnected) trigger.focus();
    };
  }, []);
  useEffect(() => { if (step === 1) inputRef.current?.focus(); }, [step]);

  const toStep2 = (e: FormEvent) => {
    e.preventDefault();
    if (password.length === 0) return;
    setError(null); setNotice(null);
    setStep(2);
  };

  const onCredential = async (credential: string) => {
    if (busy) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const user = await api.auth.googleLink(credential, password);
      onLinked(user);
    } catch (err) {
      const outcome = linkErrorOutcome(err, SERVER_MSG.wrongPassword, SERVER_MSG.googleTokenInvalid);
      if (outcome === 'wrongPassword') { setStep(1); setNotice(copy.link.wrongPassword); }
      else if (outcome === 'tokenInvalid') setNotice(copy.link.tokenInvalid);
      else if (outcome === 'closeCooldown') onCooldown();
      else if (outcome === 'hide') onHide();
      else if (outcome === 'unavailable') onUnavailable();
      else setError(err instanceof ApiError ? err : new Error(copy.common.networkError));
    } finally {
      setPassword('');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="link-title" className="console-card max-h-[90vh] w-full max-w-[440px] overflow-y-auto rounded-b-none p-5 sm:rounded-b-2xl sm:p-7">
        <h2 id="link-title" className="text-xl font-black text-slate-900">{copy.link.modalTitle}</h2>
        <p className="mt-2 text-sm text-slate-600">{step === 1 ? copy.link.step1 : copy.link.step2}</p>
        <div className="mt-4 space-y-4">
          {notice && <Message color="red">{notice}</Message>}
          <ErrorLine error={error} />
          {step === 1 ? (
            <form onSubmit={toStep2} className="space-y-4">
              <Field label={copy.link.passwordLabel}>
                <input ref={inputRef} name="password" type="password" className={inputClass} maxLength={1024} value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
              </Field>
              <Button type="submit" disabled={password.length === 0}>{copy.link.next}</Button>
            </form>
          ) : (
            <div className="space-y-3">
              <GoogleButton onCredential={onCredential} disabled={busy} text="signin_with" />
              {busy && <p role="status" className="text-center text-sm font-bold text-slate-600">{copy.link.working}</p>}
              <Button variant="ghost" onClick={() => { setPassword(''); setStep(1); }} disabled={busy}>{copy.link.back}</Button>
            </div>
          )}
          <Button variant="secondary" onClick={onClose}>{copy.link.close}</Button>
        </div>
      </div>
    </div>
  );
}
