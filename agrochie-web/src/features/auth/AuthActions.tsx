import type { ReactNode } from 'react';
import { User } from 'lucide-react';

/**
 * Gaya seragam tombol aksi /masuk dan /daftar (tampilan saja).
 * Lebar 100% sampai 400px (sama dengan tombol Google), tinggi 44px, sudut pill, rata tengah.
 */
export const ACTION_MAX_W = 'max-w-[400px]';
const base = 'w-full h-11 min-h-11 rounded-full text-base font-extrabold inline-flex items-center justify-center gap-2 '
  + 'focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-emerald-800 '
  + 'disabled:opacity-60 disabled:cursor-not-allowed';

/** Pembungkus tombol primer (komponen Button bersama): memaksa lebar penuh, tinggi, sudut, dan fokus. */
export function AuthPrimary({ children }: { children: ReactNode }) {
  return (
    <div className={`w-full ${ACTION_MAX_W} mx-auto pt-2 `
      + '[&>button]:w-full [&>button]:h-11 [&>button]:min-h-11 [&>button]:rounded-full [&>button]:text-base [&>button]:py-0 '
      + '[&>button]:focus-visible:outline-[3px] [&>button]:focus-visible:outline-offset-2 [&>button]:focus-visible:outline-emerald-800 '
      + '[&>button]:disabled:cursor-not-allowed'}>
      {children}
    </div>
  );
}

/** Tombol tersier "Masuk sebagai tamu sementara" + keterangan di bawahnya. */
export function GuestAction({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <div className={`w-full ${ACTION_MAX_W} mx-auto mt-3`}>
      <button type="button" disabled={disabled} onClick={onClick}
        className={`${base} border border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-50`}>
        <User size={18} /> Masuk sebagai tamu sementara
      </button>
      <p className="text-xs text-slate-500 text-center mt-3">Data tamu tersimpan di server dan dihapus saat logout.</p>
    </div>
  );
}
