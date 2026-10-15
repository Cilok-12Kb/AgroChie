'use client';
import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError, type Account } from '../console/api';
import type { Workspace } from '../console/hooks';
import { Button, Card, ErrorLine, Field, inputClass, Message, Tag } from '../console/ui';
import { copy } from './copy';
import { emailErrorOutcome, looksLikeEmail } from './logic';
import { SERVER_MSG } from './serverMessages';
import { useCooldown } from './useCooldown';

/** Kartu "Keamanan akun" di halaman profil (id="akun"). Tidak tampil untuk akun tamu atau bila server membalas 403. */
export function AccountSecurity({ w }: { w: Workspace }) {
  const queryClient = useQueryClient();
  const account = w.account.data;
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState<'save' | 'resend' | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [hidden, setHidden] = useState(false);
  const cooldown = useCooldown(60);

  if (!account || account.isGuest !== false || hidden) return null;

  const store = (user: Account) => queryClient.setQueryData(['console', 'account'], user); // cache dari respons server
  const refreshAccount = async () => {
    try { store(await api.auth.me()); } catch { /* 401 ditangani jalur global */ }
  };

  const fail = async (err: unknown) => {
    const outcome = emailErrorOutcome(err, SERVER_MSG.emailAlreadyVerified);
    if (outcome === 'hide') { setHidden(true); return; }
    if (outcome === 'refresh') { await refreshAccount(); setNote(copy.account.alreadyVerified); return; }
    if (outcome === 'cooldown') cooldown.start();
    if (outcome === 'conflict') setError(new Error(copy.account.emailConflict));
    else if (outcome === 'sendFailed') setError(new Error(copy.account.emailSendFailed));
    else if (outcome === 'unavailable') setError(new Error(copy.account.emailUnavailable));
    else setError(err instanceof ApiError ? err : new Error(copy.common.networkError));
  };

  const saveEmail = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || cooldown.left > 0) return;
    setNote(null); setError(null);
    if (!looksLikeEmail(email)) { setError(new Error(copy.account.emailInvalid)); return; }
    setBusy('save');
    try {
      const user = await api.auth.setEmail(email.trim());
      store(user);
      setEmail('');
      if (!user.emailVerified) { setNote(copy.account.emailSent); cooldown.start(); }
    } catch (err) { await fail(err); } finally { setBusy(null); }
  };

  const resend = async () => {
    if (busy || cooldown.left > 0) return;
    setNote(null); setError(null);
    setBusy('resend');
    try {
      await api.auth.resendVerification();
      setNote(copy.account.resent);
      cooldown.start();
    } catch (err) { await fail(err); } finally { setBusy(null); }
  };

  const hasEmail = !!account.email;
  const verified = hasEmail && account.emailVerified === true;

  return (
    <div id="akun" className="scroll-mt-24 mb-6">
      <Card title={copy.account.title} subtitle={copy.account.subtitle}>
        <div className="space-y-5">
          {account.needsProfileCompletion === true && <Message color="amber">{copy.account.completeProfile}</Message>}
          {account.phone == null && <p className="text-sm text-slate-600">{copy.account.phoneLater}</p>}

          <section aria-labelledby="akun-email" className="space-y-3">
            <h3 id="akun-email" className="text-sm font-extrabold text-slate-900">{copy.account.emailTitle}</h3>
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 break-all text-sm font-bold text-slate-800">{hasEmail ? account.email : copy.account.emailNone}</span>
              {hasEmail && <Tag color={verified ? 'green' : 'amber'}>{verified ? copy.account.verified : copy.account.notVerified}</Tag>}
            </div>
            {hasEmail && !verified && <Button variant="secondary" onClick={resend} busy={busy === 'resend'} disabled={cooldown.left > 0}>{copy.account.resend}</Button>}
            <form onSubmit={saveEmail} className="space-y-3">
              <Field label={hasEmail ? copy.account.emailLabelChange : copy.account.emailLabelAdd}>
                <input name="email" type="email" className={inputClass} maxLength={254} value={email} onChange={ev => setEmail(ev.target.value)} placeholder={copy.account.emailPlaceholder} autoComplete="email" autoCapitalize="none" spellCheck={false} />
              </Field>
              <Button type="submit" busy={busy === 'save'} disabled={cooldown.left > 0 || email.trim() === ''}>{copy.account.emailSave}</Button>
            </form>
            {cooldown.left > 0 && <p role="status" className="text-sm font-bold text-amber-700">{copy.common.cooldownWait(cooldown.left)}</p>}
            {note && <Message color="green">{note}</Message>}
            <ErrorLine error={error} />
          </section>
        </div>
      </Card>
    </div>
  );
}
