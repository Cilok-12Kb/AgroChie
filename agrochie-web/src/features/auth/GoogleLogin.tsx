'use client';
import { useState } from 'react';
import { api } from '../console/api';
import { ErrorLine, Message } from '../console/ui';
import { GoogleButton } from './GoogleButton';
import { copy } from './copy';
import { googleLoginOutcome, postLoginPath } from './logic';

/** Pemisah "atau" + tombol Google untuk /masuk dan /daftar. Tidak tampil bila Client ID kosong atau server membalas 503. */
export function GoogleLogin({ mode, busy, locked, onCooldown }: {
  mode: 'login' | 'register';
  busy: boolean; // form biasa sedang diproses
  locked: boolean; // cooldown 429 sedang berjalan
  onCooldown: () => void;
}) {
  const [hidden, setHidden] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [failed, setFailed] = useState(false);

  if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || hidden) return null;

  const onCredential = async (credential: string) => {
    setWorking(true);
    setError(null);
    setFailed(false);
    try {
      const user = await api.auth.google(credential);
      const dest = postLoginPath(user, new URLSearchParams(window.location.search).get('next'));
      window.location.href = dest;
    } catch (err) {
      const outcome = googleLoginOutcome(err);
      if (outcome === 'hide') setHidden(true);
      else if (outcome === 'failed') setFailed(true);
      else { if (outcome === 'cooldown') onCooldown(); setError(err); }
      setWorking(false);
    }
  };

  return (
    <div className="mt-6">
      <div className="flex items-center gap-3 text-xs font-bold uppercase text-slate-400" role="separator">
        <span className="h-px flex-1 bg-slate-200" />{copy.google.divider}<span className="h-px flex-1 bg-slate-200" />
      </div>
      <div className="mt-3 space-y-3">
        <GoogleButton onCredential={onCredential} disabled={busy || working || locked} text={mode === 'login' ? 'signin_with' : 'signup_with'} />
        {working && <p role="status" className="text-sm text-slate-600 text-center font-bold">{copy.google.signingIn}</p>}
        {failed && <Message color="red">{copy.google.failed}</Message>}
        <ErrorLine error={error} />
      </div>
    </div>
  );
}
