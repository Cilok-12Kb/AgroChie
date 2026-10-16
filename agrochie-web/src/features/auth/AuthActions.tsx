'use client';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, LoaderCircle, User } from 'lucide-react';
import { useTranslation } from '../../i18n';

/**
 * Gaya seragam tombol aksi /masuk dan /daftar (tampilan saja).
 * Lebar 100% sampai 400px (sama dengan tombol Google), tinggi 44px, sudut pill, rata tengah.
 * Tombol dibuat langsung di sini (bukan lewat Button bersama): .console-button di globals.css
 * tidak berada di @layer sehingga mengalahkan utilitas Tailwind (min-height, radius, padding, font-size).
 */
export const ACTION_MAX_W = 'max-w-[400px]';
const base = 'h-11 min-h-11 rounded-full text-base font-extrabold inline-flex items-center justify-center gap-2 '
  + 'transition-colors focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-emerald-800 '
  + 'disabled:cursor-not-allowed';

/**
 * Baris tombol submit.
 * - register: tombol lebar penuh (maks 400px, rata tengah).
 * - login: tombol "Masuk" di kiri, tautan "Lupa kata sandi?" di kanan (satu baris; turun bila sempit).
 */
export function AuthSubmitRow({ type, busy, disabled, children }: {
  type: 'login' | 'register';
  busy: boolean;
  disabled: boolean;
  children: ReactNode;
}) {
  const copy = useTranslation().t.auth;
  const button = (
    <button type="submit" disabled={busy || disabled}
      className={`${base} bg-[#16663e] text-white hover:bg-[#0e502f] disabled:opacity-60 ${type === 'login' ? 'px-8' : 'w-full px-4'}`}>
      {busy ? <LoaderCircle size={18} className="animate-spin" /> : <ArrowRight size={18} />} {children}
    </button>
  );
  if (type === 'register') return <div className={`w-full ${ACTION_MAX_W} mx-auto pt-2`}>{button}</div>;
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 pt-2">
      {button}
      <Link href="/lupa-password"
        className="inline-flex items-center min-h-11 px-1 text-sm text-emerald-700 font-black hover:underline rounded-md focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-emerald-800">
        {copy.login.forgotLink}
      </Link>
    </div>
  );
}

/** Tombol tersier "Masuk sebagai tamu sementara" + keterangan di bawahnya. */
export function GuestAction({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  const copy = useTranslation().t.auth;
  return (
    <div className={`w-full ${ACTION_MAX_W} mx-auto mt-3`}>
      <button type="button" disabled={disabled} onClick={onClick}
        className={`${base} w-full border border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-50 disabled:opacity-60`}>
        <User size={18} /> {copy.login.guestSubmit}
      </button>
      <p className="text-xs text-slate-500 text-center mt-3">{copy.login.guestHint}</p>
    </div>
  );
}
