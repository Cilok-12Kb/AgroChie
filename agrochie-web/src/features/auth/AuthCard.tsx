import type { ReactNode } from 'react';
import { BrandLogo } from '@/components/brand/BrandLogo';

/** Kartu auth bersama (merek + judul) untuk halaman lupa/reset/verifikasi. Gaya sama dengan AuthForm. */
export function AuthCard({ kicker, title, description, children }: { kicker: string; title: string; description?: string; children: ReactNode }) {
  return (
    <div className="console-card max-w-[440px] w-full shadow-xl shadow-emerald-950/5 p-7 md:p-9">
      <div className="flex gap-3 items-center">
        <BrandLogo size={40} priority alt="" />
        <div><p className="text-2xl font-black tracking-tight text-slate-900">Agro<span className="text-emerald-700">Chie</span></p><p className="text-xs text-slate-500 font-bold">Smart farming workspace</p></div>
      </div>
      <div className="mt-9 mb-7">
        <p className="text-[11px] font-black tracking-[.15em] uppercase text-emerald-700">{kicker}</p>
        <h1 className="font-black text-slate-900 tracking-tight text-[27px] mt-2">{title}</h1>
        {description && <p className="text-sm text-slate-500 mt-2">{description}</p>}
      </div>
      {children}
    </div>
  );
}
