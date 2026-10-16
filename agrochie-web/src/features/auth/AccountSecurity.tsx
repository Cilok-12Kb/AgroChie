'use client';
import { useRef, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError, type Account } from '../console/api';
import type { Workspace } from '../console/hooks';
import { Button, Card, ErrorLine, Field, inputClass, Message, Tag } from '../console/ui';
import { copy } from './copy';
import { GoogleLinkModal } from './GoogleLinkModal';
import { ReauthModal } from './ReauthModal';
import { accountActionOutcome, canLinkGoogle, canRemoveEmail, canUnlinkGoogle, emailErrorOutcome, looksLikeEmail, phoneProblem } from './logic';
import { SERVER_MSG } from './serverMessages';
import { useCooldown } from './useCooldown';
import { useTranslation } from '../../i18n';

type AccountAction = 'phone' | 'email' | 'google';

const phoneErrorText = (problem: ReturnType<typeof phoneProblem>, a: { phoneInvalid: string; phoneSame: string }) =>
  problem === 'same' ? a.phoneSame : a.phoneInvalid;

// [REVISI] B7-6: nomor HP, hapus email, dan lepas Google memakai modal re-autentikasi B7-5.

/** Kartu "Keamanan akun" di halaman profil (id="akun"). Tidak tampil untuk akun tamu atau bila server membalas 403. */
export function AccountSecurity({ w }: { w: Workspace }) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const a = t.accountActions;
  const account = w.account.data;
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState<'save' | 'resend' | 'phone' | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [phoneError, setPhoneError] = useState<unknown>(null);
  const [actionNote, setActionNote] = useState<{ action: AccountAction; ok: boolean; text: string } | null>(null);
  const [reauth, setReauth] = useState<{ action: AccountAction; phone?: string } | null>(null);
  const [hidden, setHidden] = useState(false);
  const cooldown = useCooldown(60);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUnavailable, setLinkUnavailable] = useState(false);
  const [linkNote, setLinkNote] = useState<{ ok: boolean; text: string } | null>(null);
  const phoneTrigger = useRef<HTMLButtonElement>(null);
  const emailTrigger = useRef<HTMLButtonElement>(null);
  const googleTrigger = useRef<HTMLButtonElement>(null);
  const phoneHeading = useRef<HTMLHeadingElement>(null);
  const emailHeading = useRef<HTMLHeadingElement>(null);
  const googleHeading = useRef<HTMLHeadingElement>(null);

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

  const savePhone = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setPhoneError(null); setActionNote(null);
    const problem = phoneProblem(phone, account.phone);
    if (problem) { setPhoneError(new Error(phoneErrorText(problem, a))); return; }
    if (account.phone) { setReauth({ action: 'phone', phone }); return; }
    setBusy('phone');
    try {
      store(await api.auth.setPhone(phone));
      setPhone('');
      setActionNote({ action: 'phone', ok: true, text: a.phoneSavedAdd });
    } catch (err) {
      const outcome = accountActionOutcome(err, SERVER_MSG);
      if (outcome === 'phoneTaken') setPhoneError(new Error(a.phoneTaken));
      else if (outcome === 'closeCooldown') setPhoneError(new Error(a.tooMany));
      else if (outcome === 'hide') setHidden(true);
      else setPhoneError(err instanceof ApiError ? err : new Error(copy.common.networkError));
    } finally { setBusy(null); }
  };

  const hasEmail = !!account.email;
  const verified = hasEmail && account.emailVerified === true;
  const fallbackFocus = reauth?.action === 'phone' ? phoneHeading : reauth?.action === 'email' ? emailHeading : googleHeading;
  const modalNote = (text: string, ok = false) => {
    const action = reauth?.action;
    if (action) setActionNote({ action, ok, text });
  };

  return (
    <div id="akun" className="scroll-mt-24 mb-6">
      <Card title={copy.account.title} subtitle={copy.account.subtitle}>
        <div className="space-y-5">
          {account.needsProfileCompletion === true && <Message color="amber">{copy.account.completeProfile}</Message>}

          <section aria-labelledby="akun-phone" className="space-y-3">
            <h3 ref={phoneHeading} id="akun-phone" tabIndex={-1} className="text-sm font-extrabold text-slate-900">{a.phoneTitle}</h3>
            <p data-no-translate={account.phone ? true : undefined} className="break-all text-sm font-bold text-slate-800">{account.phone ?? a.phoneNone}</p>
            <p className="text-sm text-slate-600">{a.phoneHelp}</p>
            <form onSubmit={savePhone} className="space-y-3">
              <Field label={account.phone ? a.phoneLabelChange : a.phoneLabelAdd}>
                <input name="phone" type="tel" inputMode="numeric" autoComplete="tel" maxLength={20} className={inputClass} value={phone} onChange={ev => setPhone(ev.target.value)} placeholder={a.phonePlaceholder} />
              </Field>
              <button ref={phoneTrigger} type="submit" className="console-button console-button-primary" disabled={phone.trim() === '' || busy === 'phone'}>
                {busy === 'phone' ? a.working : account.phone ? a.phoneSaveChange : a.phoneSaveAdd}
              </button>
            </form>
            {actionNote?.action === 'phone' && <Message color={actionNote.ok ? 'green' : 'amber'}>{actionNote.text}</Message>}
            <ErrorLine error={phoneError} />
          </section>

          <section aria-labelledby="akun-email" className="space-y-3 border-t border-slate-100 pt-5">
            <h3 ref={emailHeading} id="akun-email" tabIndex={-1} className="text-sm font-extrabold text-slate-900">{copy.account.emailTitle}</h3>
            <div className="flex flex-wrap items-center gap-2">
              <span data-no-translate={hasEmail ? true : undefined} className="min-w-0 break-all text-sm font-bold text-slate-800">{hasEmail ? account.email : copy.account.emailNone}</span>
              {hasEmail && <Tag color={verified ? 'green' : 'amber'}>{verified ? copy.account.verified : copy.account.notVerified}</Tag>}
            </div>
            {hasEmail && !verified && <Button variant="secondary" onClick={resend} busy={busy === 'resend'} disabled={cooldown.left > 0}>{copy.account.resend}</Button>}
            {hasEmail && (canRemoveEmail(account)
              ? <button ref={emailTrigger} type="button" className="console-button console-button-secondary" onClick={() => { setActionNote(null); setReauth({ action: 'email' }); }}>{a.emailRemove}</button>
              : <p className="text-sm text-amber-700">{a.emailLastHint}</p>)}
            {actionNote?.action === 'email' && <Message color={actionNote.ok ? 'green' : 'amber'}>{actionNote.text}</Message>}
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

          {(account.hasGoogle === true || (canLinkGoogle(account) && !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID)) && (
            <section aria-labelledby="akun-google" className="space-y-3 border-t border-slate-100 pt-5">
              <h3 ref={googleHeading} id="akun-google" tabIndex={-1} className="text-sm font-extrabold text-slate-900">{copy.link.title}</h3>
              {account.hasGoogle === true ? (
                <>
                  <Tag color="green">{copy.link.connected}</Tag>
                  {canUnlinkGoogle(account)
                    ? <button ref={googleTrigger} type="button" className="console-button console-button-secondary" onClick={() => { setActionNote(null); setReauth({ action: 'google' }); }}>{a.googleUnlink}</button>
                    : <p className="text-sm text-amber-700">{a.googleLastHint}</p>}
                  {actionNote?.action === 'google' && <Message color={actionNote.ok ? 'green' : 'amber'}>{actionNote.text}</Message>}
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-600">{copy.link.notConnected}</p>
                  {linkUnavailable && <Message color="amber">{copy.link.unavailable}</Message>}
                  <Button variant="secondary" onClick={() => { setLinkNote(null); setLinkOpen(true); }} disabled={linkUnavailable}>{copy.link.open}</Button>
                </>
              )}
              {linkNote && <Message color={linkNote.ok ? 'green' : 'amber'}>{linkNote.text}</Message>}
            </section>
          )}
        </div>
      </Card>
      {reauth && (
        <ReauthModal
          action={reauth.action}
          account={account}
          phone={reauth.phone}
          fallbackFocus={fallbackFocus}
          onClose={() => setReauth(null)}
          onHide={() => setHidden(true)}
          onNote={modalNote}
          onRefresh={() => { void refreshAccount(); }}
          onSuccess={user => {
            const action = reauth.action;
            store(user);
            setPhone('');
            setReauth(null);
            setActionNote({ action, ok: true, text: action === 'phone' ? a.phoneSavedChange : action === 'email' ? a.emailRemoved : a.googleUnlinked });
          }}
        />
      )}
      {linkOpen && (
        <GoogleLinkModal
          onClose={() => setLinkOpen(false)}
          onLinked={user => { store(user); setLinkOpen(false); setLinkNote({ ok: true, text: copy.link.success }); }}
          onHide={() => { setLinkOpen(false); setHidden(true); }}
          onUnavailable={() => { setLinkOpen(false); setLinkUnavailable(true); }}
          onCooldown={() => { setLinkOpen(false); setLinkNote({ ok: false, text: copy.link.tooMany }); }}
        />
      )}
    </div>
  );
}
