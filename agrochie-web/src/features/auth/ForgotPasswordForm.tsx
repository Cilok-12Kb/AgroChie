'use client';
import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { api, ApiError } from '../console/api';
import { Button, ErrorLine, Field, inputClass, Message } from '../console/ui';
import { AuthCard } from './AuthCard';
import { copy } from './copy';
import { isStatus, looksLikeEmail } from './logic';
import { useCooldown } from './useCooldown';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState<string | null>(null);
  const cooldown = useCooldown(60);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (cooldown.left > 0) return;
    setError(null);
    if (!looksLikeEmail(email)) { setError(new Error(copy.forgot.emailInvalid)); return; }
    setLoading(true);
    try {
      const res = await api.auth.forgotPassword(email.trim());
      setMessage(res.message); // selalu tampilkan pesan server apa adanya (tidak membocorkan akun ada/tidak)
    } catch (err) {
      if (isStatus(err, 429)) cooldown.start();
      if (isStatus(err, 503)) setError(new Error(copy.common.emailServiceDown));
      else if (err instanceof ApiError) setError(err);
      else setError(new Error(copy.common.networkError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard kicker={copy.forgot.kicker} title={copy.forgot.title} description={copy.forgot.description}>
      {message ? (
        <div className="space-y-4">
          <Message color="green">{message}</Message>
          <Link href="/masuk" className="inline-flex items-center gap-2 text-emerald-700 text-sm font-extrabold py-2">{copy.forgot.backToLogin} <ArrowRight size={16}/></Link>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={submit} noValidate>
          <Field label={copy.forgot.emailLabel}>
            <input name="email" type="email" className={inputClass} required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} placeholder={copy.forgot.emailPlaceholder} autoComplete="email" autoCapitalize="none" spellCheck={false}/>
          </Field>
          <ErrorLine error={error}/>
          {cooldown.left > 0 && <p role="status" className="text-sm text-amber-700 font-bold">{copy.common.cooldownNote} {copy.common.cooldownWait(cooldown.left)}</p>}
          <div className="pt-2"><Button type="submit" icon={ArrowRight} busy={loading} disabled={cooldown.left > 0}>{copy.forgot.submit}</Button></div>
          <Link href="/masuk" className="inline-block py-2 text-sm text-emerald-700 font-black">{copy.forgot.backToLogin}</Link>
        </form>
      )}
    </AuthCard>
  );
}
