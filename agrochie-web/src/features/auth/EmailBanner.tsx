'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Mail, X } from 'lucide-react';
import type { Account } from '../console/api';
import { copy } from './copy';
import { shouldShowEmailBanner, readBannerDismissed, writeBannerDismissed } from './logic';

// [REVISI] A5: sessionStorage (bukan localStorage) agar kembali muncul di sesi tab berikutnya; bisa diblokir -> try/catch di logic.ts.
const session = (): Storage | null => { try { return typeof window === 'undefined' ? null : window.sessionStorage; } catch { return null; } };

/** Banner ajakan menambah/memverifikasi email. Penutupan bertahan selama sesi tab (kunci per id akun). */
export function EmailBanner({ account }: { account: Account | null | undefined }) {
  const [dismissedNow, setDismissedNow] = useState(false);
  const dismissed = dismissedNow || readBannerDismissed(session(), account?.id);
  if (!shouldShowEmailBanner(account, dismissed)) return null;
  const text = account?.email ? copy.banner.unverified : copy.banner.noEmail;
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <Mail size={18} className="shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1 basis-56 font-bold">{text}</p>
      <Link href="/profil#akun" className="inline-flex min-h-11 items-center rounded-xl bg-amber-600 px-4 font-extrabold text-white">{copy.banner.action}</Link>
      <button type="button" aria-label={copy.banner.dismiss} title={copy.banner.dismiss} onClick={() => { writeBannerDismissed(session(), account?.id); setDismissedNow(true); }} className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-amber-800 hover:bg-amber-100">
        <X size={18} />
      </button>
    </div>
  );
}
