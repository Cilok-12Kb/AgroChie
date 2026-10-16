'use client';
import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { AuthSubmitRow, GuestAction } from '../auth/AuthActions'; // [REVISI] tampilan
import { api } from './api';
import { ErrorLine, Field, inputClass } from './ui'; // [REVISI] Button tidak dipakai lagi di sini
import { useCooldown } from '../auth/useCooldown'; // [REVISI]
import { isOptionalEmailValid, isStatus, postLoginPath, registerEmailFailure } from '../auth/logic'; // [REVISI]
import { GoogleLogin } from '../auth/GoogleLogin'; // [REVISI]
import { useTranslation } from '../../i18n';

export function AuthForm({ type }: { type: 'login' | 'register' }) {
  const { t } = useTranslation();
  const copy = t.auth;
  const formCopy = type === 'login' ? copy.login : copy.register;
  const [name,setName]=useState(''); const [phone,setPhone]=useState(''); const [password,setPassword]=useState('');
  const [show,setShow]=useState(false);const [loading,setLoading]=useState(false);const [error,setError]=useState<unknown>(null);
  const [email,setEmail]=useState(''); const [emailFailure,setEmailFailure]=useState<string|null>(null); // [REVISI] email opsional saat daftar
  const cooldown=useCooldown(60); // [REVISI] 429 -> tombol terkunci 60 detik di klien
  // [REVISI] login memakai identifier (HP/email); tujuan ditentukan needsProfileCompletion + ?next= aman; sandi dikosongkan setelah submit.
  const submit=async(e:FormEvent)=>{e.preventDefault();if(cooldown.left>0||loading)return;if(type==='register'&&!isOptionalEmailValid(email)){setError(new Error(copy.register.emailInvalid));return;}setLoading(true);setError(null);try { let dest='/profil';if(type==='login'){const user=await api.auth.login(phone.trim(),password);dest=postLoginPath(user,new URLSearchParams(window.location.search).get('next'));}else { await api.auth.register(name,phone,password);
    // [REVISI] email opsional: panggilan kedua setelah akun jadi; gagal -> akun tetap ada, tampilkan pesan + tombol ke Profil.
    if(email.trim()){try{await api.auth.setEmailAfterRegister(email.trim());}catch(e2){setPassword('');setEmailFailure(copy.register.emailFailed(copy.register.reason[registerEmailFailure(e2)]));setLoading(false);return;}} }setPassword('');window.location.href=dest; } catch(e){setPassword('');if(isStatus(e,429))cooldown.start();setError(e);setLoading(false);} };
  const guest=async()=>{setLoading(true);setError(null);try{await api.auth.guest();window.location.href='/profil';}catch(e){setError(e);setLoading(false);}};
  return <div className="console-card max-w-[440px] w-full shadow-xl shadow-emerald-950/5 p-7 md:p-9">
    <div className="flex gap-3 items-center"><BrandLogo size={40} priority alt=""/><div><p className="text-2xl font-black tracking-tight text-slate-900">Agro<span className="text-emerald-700">Chie</span></p><p className="text-xs text-slate-500 font-bold">{t.shell.tagline}</p></div></div>
    <div className="mt-9 mb-7"><p className="text-[11px] font-black tracking-[.15em] uppercase text-emerald-700">{formCopy.kicker}</p><h1 className="font-black text-slate-900 tracking-tight text-[27px] mt-2">{formCopy.title}</h1><p className="text-sm text-slate-500 mt-2">{formCopy.description}</p></div>
    {emailFailure?<div className="space-y-4"><p role="status" className="text-sm text-slate-700 font-bold">{emailFailure}</p><Link href="/profil" className="w-full rounded-xl bg-emerald-700 text-white py-3.5 text-base font-extrabold flex justify-center items-center gap-2">{copy.register.goProfile} <ArrowRight size={18}/></Link></div>:<>
    <form className="space-y-4" onSubmit={submit}>
      {type==='register'&&<Field label={copy.register.nameLabel}><input name="name" className={inputClass} required maxLength={100} value={name} onChange={e=>setName(e.target.value)} placeholder={copy.register.namePlaceholder} autoComplete="name"/></Field>}
      {type==='login'
        ? <Field label={copy.login.identifierLabel} hint={copy.login.identifierHint}><input name="identifier" className={inputClass} required maxLength={254} value={phone} onChange={e=>setPhone(e.target.value)} placeholder={copy.login.identifierPlaceholder} autoComplete="username" autoCapitalize="none" spellCheck={false}/></Field>
        : <Field label={copy.register.phoneLabel} hint={copy.register.phoneHint}><input name="phone" className={inputClass} required inputMode="tel" pattern="[0-9+\- ]{8,18}" value={phone} onChange={e=>setPhone(e.target.value)} placeholder={copy.register.phonePlaceholder} autoComplete="tel"/></Field>}
      {type==='register'&&<Field label={copy.register.emailLabel} hint={copy.register.emailHint}><input name="email" type="email" className={inputClass} maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} placeholder={copy.register.emailPlaceholder} autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false}/></Field>}
      <Field label={formCopy.passwordLabel}><div className="relative"><input className={`${inputClass} pr-12`} type={show?'text':'password'} required minLength={type==='register'?8:1} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} autoComplete={type==='register'?'new-password':'current-password'} placeholder={formCopy.passwordPlaceholder}/><button type="button" title={formCopy.passwordToggle} aria-label={formCopy.passwordToggle} className="absolute top-3.5 right-3 text-slate-500" onClick={()=>setShow(s=>!s)}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></Field>
      <ErrorLine error={error}/>{cooldown.left>0&&<p role="status" className="text-sm text-amber-700 font-bold">{copy.common.cooldownNote} {copy.common.cooldownWait(cooldown.left)}</p>}<AuthSubmitRow type={type} busy={loading} disabled={cooldown.left>0}>{formCopy.submit}</AuthSubmitRow>{/* [REVISI] tampilan: Masuk + Lupa sandi sebaris; Daftar lebar penuh */}
    </form>
    {/* [REVISI] tombol Google di /masuk dan /daftar */}
    <GoogleLogin mode={type} busy={loading} locked={cooldown.left>0} onCooldown={cooldown.start}/></>}
    {type==='login'&&<GuestAction disabled={loading} onClick={guest}/>}{/* [REVISI] tampilan: tombol tamu seragam */}
    <p className="text-sm text-center text-slate-500 mt-6">{type==='login'?<>{copy.login.noAccount} <Link href="/daftar" className="text-emerald-700 font-black">{copy.login.registerNow}</Link></>:<>{copy.register.hasAccount} <Link href="/masuk" className="text-emerald-700 font-black">{copy.register.loginNow}</Link></>}</p>
  </div>;
}
