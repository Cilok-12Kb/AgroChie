'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, LoaderCircle } from 'lucide-react';
import { api, ApiError } from '../console/api';
import { Button, ErrorLine, Message } from '../console/ui';
import { AuthCard } from './AuthCard';
import { copy } from './copy';
import { isApiMessage, isStatus } from './logic';
import { SERVER_MSG } from './serverMessages';
import { useCooldown } from './useCooldown';

type Phase = 'loading' | 'ok' | 'invalid' | 'error';

export function VerifyEmail() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useSearchParams();
  // Token dibaca sekali lalu dihapus dari URL; tidak dicatat atau disimpan di tempat lain.
  const [token] = useState(() => params.get('token') ?? '');
  const [phase, setPhase] = useState<Phase>(token ? 'loading' : 'invalid');
  const [error, setError] = useState<unknown>(null);
  const started = useRef(false); // penjaga: token sekali pakai, Strict Mode menjalankan efek dua kali
  const [resendBusy, setResendBusy] = useState(false);
  const [resent, setResent] = useState(false);
  const [resendError, setResendError] = useState<unknown>(null);
  const cooldown = useCooldown(60);

  useEffect(() => {
    if (params.has('token')) router.replace('/verify-email');
  }, [params, router]);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    api.auth.verifyEmail(token).then(
      () => {
        setPhase('ok');
        queryClient.invalidateQueries({ queryKey: ['console', 'account'] }); // segarkan emailVerified bila ada sesi
      },
      (err: unknown) => {
        if (isApiMessage(err, 400, SERVER_MSG.verifyLinkInvalid)) setPhase('invalid');
        else { setError(err instanceof ApiError ? err : new Error(copy.common.networkError)); setPhase('error'); }
      },
    );
  }, [token, queryClient]);

  // Hanya tanya sesi saat perlu menawarkan "kirim ulang" / "beranda"; 401 = belum masuk (bukan galat).
  const needSession = phase === 'invalid' || phase === 'ok';
  const session = useQuery({ queryKey: ['console', 'account'], queryFn: api.auth.me, enabled: needSession, retry: false, staleTime: 30_000 });
  const loggedIn = !!session.data && !session.data.isGuest;

  const resend = async () => {
    if (cooldown.left > 0) return;
    setResendBusy(true);
    setResendError(null);
    try {
      await api.auth.resendVerification();
      setResent(true);
      cooldown.start();
    } catch (err) {
      if (isStatus(err, 429)) cooldown.start();
      if (isApiMessage(err, 400, SERVER_MSG.emailAlreadyVerified)) queryClient.invalidateQueries({ queryKey: ['console', 'account'] });
      setResendError(err instanceof ApiError ? err : new Error(copy.common.networkError));
    } finally {
      setResendBusy(false);
    }
  };

  return (
    <AuthCard kicker={copy.verify.kicker} title={copy.verify.title}>
      {phase === 'loading' && <p role="status" className="flex items-center gap-3 text-slate-600 font-bold"><LoaderCircle className="animate-spin" size={20}/> {copy.verify.loading}</p>}
      {phase === 'ok' && (
        <div className="space-y-4">
          <Message color="green">{copy.verify.success}</Message>
          <Link href={loggedIn ? '/beranda' : '/masuk'} className="inline-flex items-center gap-2 text-emerald-700 text-sm font-extrabold py-2">{loggedIn ? copy.verify.goHome : copy.verify.goLogin} <ArrowRight size={16}/></Link>
        </div>
      )}
      {phase === 'invalid' && (
        <div className="space-y-4">
          <Message color="red">{token ? copy.verify.linkInvalid : copy.verify.noToken}</Message>
          {loggedIn ? (
            <>
              {resent && <Message color="green">{copy.verify.resent}</Message>}
              <ErrorLine error={resendError}/>
              {cooldown.left > 0 && <p role="status" className="text-sm text-amber-700 font-bold">{copy.common.cooldownWait(cooldown.left)}</p>}
              <Button onClick={resend} busy={resendBusy} disabled={cooldown.left > 0}>{copy.verify.resend}</Button>
            </>
          ) : (
            !session.isPending && <Link href="/masuk" className="inline-flex items-center gap-2 text-emerald-700 text-sm font-extrabold py-2">{copy.verify.goLogin} <ArrowRight size={16}/></Link>
          )}
        </div>
      )}
      {phase === 'error' && <ErrorLine error={error}/>}
    </AuthCard>
  );
}
