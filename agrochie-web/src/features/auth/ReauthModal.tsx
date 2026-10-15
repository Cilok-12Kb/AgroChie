'use client';
import { useRef, useState, type FormEvent, type RefObject } from 'react';
import { api, ApiError, type Account, type ReauthCredential } from '../console/api';
import { Button, ErrorLine, Field, inputClass } from '../console/ui';
import { GoogleButton } from './GoogleButton';
import { accountActionOutcome, reauthKind } from './logic';
import { SERVER_MSG } from './serverMessages';
import { useDialogA11y } from './useDialogA11y';
import { useTranslation } from '../../i18n';

type Action = 'phone' | 'email' | 'google';
type Props = { action: Action; account: Account; phone?: string; onClose: () => void; onSuccess: (user: Account) => void; onHide: () => void; onNote: (text: string, ok?: boolean) => void; returnFocus?: RefObject<HTMLElement | null> };

/** Modal konfirmasi dan re-autentikasi lokal; password/idToken tidak disimpan atau dicatat. */
export function ReauthModal({ action, account, phone, onClose, onSuccess, onHide, onNote, returnFocus }: Props) {
  const { t } = useTranslation(); const a = t.accountActions;
  const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState<unknown>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const kind = reauthKind(account); const initial = kind === 'password' ? passwordRef : null;
  const dialogRef = useDialogA11y(true, initial, onClose, returnFocus);
  const title = action === 'phone' ? a.modalPhoneTitle : action === 'email' ? a.modalEmailTitle : a.modalGoogleTitle;
  const body = action === 'phone' ? a.modalPhoneBody : action === 'email' ? a.modalEmailBody : a.modalGoogleBody;
  const confirm = action === 'phone' ? a.confirmPhone : action === 'email' ? a.confirmEmail : a.confirmGoogle;
  const call = (credential: ReauthCredential) => action === 'phone' ? api.auth.setPhone(phone ?? '', credential) : action === 'email' ? api.auth.removeEmail(credential) : api.auth.unlinkGoogle(credential);
  const submit = async (credential: ReauthCredential) => {
    if (busy) return; setBusy(true); setError(null);
    try { onSuccess(await call(credential)); }
    catch (err) {
      const outcome = accountActionOutcome(err, SERVER_MSG);
      if (outcome === 'wrongPassword') { setPassword(''); setError(new Error(a.wrongPassword)); requestAnimationFrame(() => passwordRef.current?.focus()); }
      else if (outcome === 'wrongGoogle') setError(new Error(a.wrongGoogle));
      else if (outcome === 'closeCooldown') { onClose(); onNote(a.tooMany); }
      else if (outcome === 'lastMethod') { onClose(); onNote(a.lastMethod); }
      else if (outcome === 'busy') { onClose(); onNote(a.busy); }
      else if (outcome === 'stale') { onClose(); onNote(a.stale); }
      else if (outcome === 'hide') { onClose(); onHide(); }
      else if (outcome === 'unavailable') setError(new Error(a.googleUnavailable));
      else setError(err instanceof ApiError ? err : new Error('Network error'));
    } finally { setPassword(''); setBusy(false); }
  };
  const onPassword = (e: FormEvent) => { e.preventDefault(); if (password) void submit({ password }); };
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="reauth-title" aria-describedby="reauth-body" className="console-card max-h-[90vh] w-full max-w-[440px] overflow-y-auto rounded-b-none p-5 sm:rounded-b-2xl sm:p-7">
      <h2 id="reauth-title" className="text-xl font-black text-slate-900">{title}</h2>
      <p id="reauth-body" className="mt-2 text-sm text-slate-600">{body}</p>
      {action === 'email' && account.hasPassword === true && !account.phone && <p className="mt-2 text-sm font-bold text-amber-700">{a.modalEmailBodyNoPhone}</p>}
      {action === 'google' && account.emailVerified === true && <p className="mt-2 text-sm font-bold text-amber-700">{a.modalGoogleBodyRelink}</p>}
      <div className="mt-4 space-y-4">
        {kind === 'password' ? <form onSubmit={onPassword} className="space-y-4"><p className="text-sm text-slate-600">{a.reauthPasswordIntro}</p><Field label={a.passwordLabel}><input ref={passwordRef} type="password" className={inputClass} maxLength={1024} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></Field><Button type="submit" disabled={!password || busy} busy={busy}>{confirm}</Button></form> : <><p className="text-sm text-slate-600">{a.reauthGoogleIntro}</p><GoogleButton onCredential={idToken => void submit({ idToken })} disabled={busy} text="signin_with" /></>}
        {busy && <p role="status" className="text-sm font-bold text-slate-600">{a.working}</p>}
        {error !== null && <div role="alert"><ErrorLine error={error} /></div>}
        <Button variant="secondary" onClick={onClose} disabled={busy}>{a.cancel}</Button>
      </div>
    </div>
  </div>;
}
