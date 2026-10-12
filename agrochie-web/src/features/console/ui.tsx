'use client';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, AlertCircle, Database, LockKeyhole, LoaderCircle, type LucideIcon } from 'lucide-react';
import { rupiah, type Season } from './api';

export function Card({ title, subtitle, action, children, className = '' }: { title?: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`console-card ${className}`}>
    {(title || subtitle || action) && <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div>{title && <h2 className="font-extrabold text-[17px] tracking-tight text-slate-900">{title}</h2>}{subtitle && <p className="text-[13px] text-slate-500 mt-1">{subtitle}</p>}</div>{action}
    </div>}
    {children}
  </section>;
}
export function Heading({ kicker, title, description, action }: { kicker?: string; title: string; description: string; action?: ReactNode }) {
  return <div className="console-heading"><div><p className="text-[11px] uppercase tracking-[.17em] font-extrabold text-emerald-700 mb-2">{kicker ?? 'AgroChie / Workspace'}</p><h1 className="text-[clamp(25px,2.2vw,33px)] tracking-[-.035em] font-black leading-tight text-slate-900">{title}</h1><p className="text-slate-500 text-sm mt-2">{description}</p></div>{action}</div>;
}
export function Tag({ children, color = 'green' }: { children: ReactNode; color?: 'green' | 'amber' | 'gray' | 'red' }) { return <span className={`console-tag console-tag-${color}`}>{children}</span>; }
export function Button({ children, onClick, type = 'button', busy = false, variant = 'primary', disabled = false, icon: Icon }: { children: ReactNode; onClick?: () => void; type?: 'button' | 'submit'; busy?: boolean; variant?: 'primary' | 'secondary' | 'ghost'; disabled?: boolean; icon?: LucideIcon }) {
  return <button type={type} onClick={onClick} className={`console-button console-button-${variant}`} disabled={disabled || busy}>{busy ? <LoaderCircle size={16} className="animate-spin"/> : Icon && <Icon size={16}/>} {children}</button>;
}
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) { return <label className="block"><span className="block text-xs font-bold text-slate-700 mb-2">{label}</span>{children}{hint && <span className="block mt-1.5 text-xs text-slate-500">{hint}</span>}</label>; }
export const inputClass = 'console-input';
export function Message({ children, color = 'amber' }: { children: ReactNode; color?: 'amber' | 'red' | 'green' }) { return <div className={`console-message console-message-${color}`}><AlertCircle size={17} className="shrink-0 mt-0.5"/><div>{children}</div></div>; }
export function ErrorLine({ error }: { error: unknown }) { return error ? <Message color="red">{error instanceof Error ? error.message : String(error)}</Message> : null; }
export function Busy() { return <div className="console-card flex items-center justify-center gap-3 text-slate-500 min-h-40"><LoaderCircle className="animate-spin" size={20}/> Memuat data dari server...</div>; }
export function Empty({ icon: Icon = Database, title, detail, link, linkText }: { icon?: LucideIcon; title: string; detail: string; link?: string; linkText?: string }) { return <div className="console-empty"><span className="console-empty-icon"><Icon size={24}/></span><h3 className="font-extrabold text-slate-800 mt-4">{title}</h3><p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">{detail}</p>{link && <Link href={link} className="inline-flex items-center gap-2 text-emerald-700 text-sm font-extrabold mt-4">{linkText ?? 'Lanjutkan'} <ArrowRight size={16}/></Link>}</div>; }
export function Metric({ label, value, caption, icon: Icon }: { label: string; value: string; caption?: string; icon: LucideIcon }) { return <div className="console-metric"><div className="flex items-center justify-between"><span className="text-xs text-slate-500 font-bold">{label}</span><span className="text-emerald-700 bg-emerald-50 p-2 rounded-xl"><Icon size={17}/></span></div><p className="text-[clamp(20px,1.9vw,26px)] font-black tracking-tight mt-3 text-slate-900 tabular-nums">{value}</p><p className="text-xs text-slate-500 mt-1">{caption || 'Berdasarkan data yang tersedia'}</p></div>; }
export function FinanceGate({ season }: { season: Season | null }) {
  return <Card><Empty icon={LockKeyhole} title="Mulai perhitungan terlebih dahulu" detail={season ? 'Anda masih di tahap persiapan. Aktifkan pembiayaan untuk melihat semua angka prediksi dan rencana uang.' : 'Buat musim tanam terlebih dahulu, kemudian mulai pembiayaan.'} link="/musim-tanam" linkText="Buka musim tanam" /></Card>;
}
export function SmallAction({ href, icon: Icon, title, description }: { href: string; icon: LucideIcon; title: string; description: string }) { return <Link href={href} className="console-action"><span className="console-action-icon"><Icon size={20}/></span><span className="flex-1"><span className="font-extrabold text-sm block">{title}</span><span className="text-xs text-slate-500 mt-1 block">{description}</span></span><ArrowRight size={16} className="text-slate-400"/></Link>; }
export function SeasonMoney({ season }: { season: Season | null }) { return season?.status !== 'DRAFT' && season?.costPlan ? rupiah(season.costPlan.p50Jt) : 'Belum dihitung'; }
