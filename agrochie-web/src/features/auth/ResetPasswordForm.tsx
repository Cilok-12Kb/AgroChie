'use client';
import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { api, ApiError } from '../console/api';
import { Button, ErrorLine, Field, inputClass, Message } from '../console/ui';
import { AuthCard } from './AuthCard';
import { copy } from './copy';
import { checkNewPassword, isApiMessage, isStatus } from './logic';
import { SERVER_MSG } from './serverMessages';
import { useCooldown } from './useCooldown';

export function ResetPasswordForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useSearchParams();
  // Token dibaca sekali ke state lalu dihapus dari URL; tidak pernah dicatat atau disimpan di tempat lain.
  const [token] = useState(() => params.get('token') ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [linkInvalid, setLinkInvalid] = useState(false);
  const [done, setDone] = useState(false);
  const cooldown = useCooldown(60);

  useEffect(() => {
    if (params.has('token')) router.replace('/reset-password');
  }, [params, router]);

  useEffect(() => {
    if (!done) return;
    const id = setTimeout(() => router.push('/masuk'), 2500);
    return () => clearTimeout(id);
  }, [done, router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (cooldown.left > 0) return;
    setError(null);
    const problem = checkNewPassword(password, confirm);
    if (problem) { setError(new Error(copy.reset.problem[problem])); return; }
    setLoading(true);
    try {
      await api.auth.resetPassword(token, password);
      queryClient.removeQueries({ queryKey: ['console'] }); // bersihkan state user; tidak login otomatis
      setDone(true);
    } catch (err) {
      if (isApiMessage(err, 400, SERVER_MSG.resetLinkInvalid)) setLinkInvalid(true);
      else if (err instanceof ApiError) { if (isStatus(err, 429)) cooldown.start(); setError(err); }
      else setError(new Error(copy.common.networkError));
    } finally {
      setPassword('');
      setConfirm('');
      setLoading(false);
    }
  };

  if (!token || linkInvalid) {
    return (
      <AuthCard kicker={copy.reset.kicker} title={copy.reset.title}>
        <div className="space-y-4">
          <Message color="red">{linkInvalid ? copy.reset.linkInvalid : copy.reset.noToken}</Message>
          <Link href="/lupa-password" className="inline-flex items-center gap-2 text-emerald-700 text-sm font-extrabold py-2">{copy.reset.requestNew} <ArrowRight size={16}/></Link>
        </div>
      </AuthCard>
    );
  }

  if (done) {
    return (
      <AuthCard kicker={copy.reset.kicker} title={copy.reset.title}>
        <div className="space-y-4">
          <Message color="green">{copy.reset.success}</Message>
          <Link href="/masuk" className="inline-flex items-center gap-2 text-emerald-700 text-sm font-extrabold py-2">{copy.reset.goLogin} <ArrowRight size={16}/></Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard kicker={copy.reset.kicker} title={copy.reset.title} description={copy.reset.description}>
      <form className="space-y-4" onSubmit={submit} noValidate>
        <Field label={copy.reset.passwordLabel} hint={copy.reset.passwordHint}>
          <div className="relative">
            <input name="newPassword" type={show ? 'text' : 'password'} className={`${inputClass} pr-11`} required maxLength={128} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password"/>
            <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? copy.reset.hide : copy.reset.show} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">{show ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
          </div>
        </Field>
        <Field label={copy.reset.confirmLabel}>
          <input name="confirmPassword" type={show ? 'text' : 'password'} className={inputClass} required maxLength={128} value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password"/>
        </Field>
        <ErrorLine error={error}/>
        {cooldown.left > 0 && <p role="status" className="text-sm text-amber-700 font-bold">{copy.common.cooldownNote} {copy.common.cooldownWait(cooldown.left)}</p>}
        <div className="pt-2"><Button type="submit" icon={ArrowRight} busy={loading} disabled={cooldown.left > 0}>{copy.reset.submit}</Button></div>
      </form>
    </AuthCard>
  );
}
