'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppButton } from '@/components/ui/AppButton';
import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

export default function DaftarPage() {
  const router = useRouter();
  const [showPass, setShowPass] = useState(false);
  const [consent, setConsent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) return;
    setIsLoading(true);
    setTimeout(() => {
      router.push('/profil');
    }, 1000);
  }

  return (
    <div className="bg-[--surface] rounded-2xl border border-[--border] shadow-md p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[--text]">Daftar akun</h1>
        <p className="text-sm text-[--text-muted] mt-1">
          Sudah punya akun?{' '}
          <Link href="/masuk" className="text-[--primary] font-semibold hover:underline">
            Masuk
          </Link>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="name" className="block text-sm font-bold text-[--text] mb-1.5">
            Nama lengkap
          </label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            required
            placeholder="Nama Anda"
            className="w-full rounded-xl border border-[--border] bg-[--surface] px-4 py-2.5 text-[--text] placeholder:text-[--text-muted]/60 focus:outline-none focus:border-[--primary] focus:ring-2 focus:ring-[--primary]/10 transition"
          />
        </div>

        <div>
          <label htmlFor="reg-email" className="block text-sm font-bold text-[--text] mb-1.5">
            Email
          </label>
          <input
            id="reg-email"
            type="email"
            autoComplete="email"
            required
            placeholder="email@contoh.com"
            className="w-full rounded-xl border border-[--border] bg-[--surface] px-4 py-2.5 text-[--text] placeholder:text-[--text-muted]/60 focus:outline-none focus:border-[--primary] focus:ring-2 focus:ring-[--primary]/10 transition"
          />
        </div>

        <div>
          <label htmlFor="reg-password" className="block text-sm font-bold text-[--text] mb-1.5">
            Kata sandi
          </label>
          <div className="relative">
            <input
              id="reg-password"
              type={showPass ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="Minimal 8 karakter"
              className="w-full rounded-xl border border-[--border] bg-[--surface] px-4 py-2.5 pr-12 text-[--text] placeholder:text-[--text-muted]/60 focus:outline-none focus:border-[--primary] focus:ring-2 focus:ring-[--primary]/10 transition"
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[--text-muted] hover:text-[--text]"
              aria-label={showPass ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
            >
              {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            id="consent"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="w-4 h-4 mt-0.5 rounded border-[--border] accent-[--primary] flex-shrink-0"
          />
          <span className="text-sm text-[--text-muted] leading-relaxed">
            Saya menyetujui{' '}
            <Link href="#" className="text-[--primary] hover:underline font-semibold">
              kebijakan privasi
            </Link>{' '}
            dan memahami bahwa data pengeluaran saya hanya digunakan untuk perencanaan pribadi.
          </span>
        </label>

        <AppButton
          type="submit"
          className="w-full"
          size="lg"
          disabled={!consent}
          isLoading={isLoading}
        >
          Buat akun
        </AppButton>
      </form>
    </div>
  );
}
