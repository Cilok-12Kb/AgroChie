'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppButton } from '@/components/ui/AppButton';
import { Eye, EyeOff, User } from 'lucide-react';
import { useState } from 'react';

export default function MasukPage() {
  const router = useRouter();
  const [showPass, setShowPass] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    // Demo: langsung masuk
    setTimeout(() => {
      router.push('/beranda');
    }, 1000);
  }

  function handleGuest() {
    router.push('/beranda');
  }

  return (
    <div className="bg-[--surface] rounded-2xl border border-[--border] shadow-md p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[--text]">Masuk</h1>
        <p className="text-sm text-[--text-muted] mt-1">
          Belum punya akun?{' '}
          <Link href="/daftar" className="text-[--primary] font-semibold hover:underline">
            Daftar sekarang
          </Link>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="email" className="block text-sm font-bold text-[--text] mb-1.5">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            placeholder="email@contoh.com"
            className="w-full rounded-xl border border-[--border] bg-[--surface] px-4 py-2.5 text-[--text] placeholder:text-[--text-muted]/60 focus:outline-none focus:border-[--primary] focus:ring-2 focus:ring-[--primary]/10 transition"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="text-sm font-bold text-[--text]">
              Kata sandi
            </label>
            <button type="button" className="text-xs text-[--primary] hover:underline font-semibold">
              Lupa sandi?
            </button>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPass ? 'text' : 'password'}
              autoComplete="current-password"
              required
              placeholder="••••••••"
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

        <AppButton type="submit" className="w-full" size="lg" isLoading={isLoading}>
          Masuk
        </AppButton>
      </form>

      <div className="relative flex items-center gap-3">
        <div className="flex-1 h-px bg-[--border]" />
        <span className="text-xs text-[--text-muted] font-semibold">atau</span>
        <div className="flex-1 h-px bg-[--border]" />
      </div>

      <div className="space-y-2">
        <AppButton
          variant="outline"
          className="w-full"
          size="md"
          leftIcon={<User size={17} />}
          onClick={handleGuest}
        >
          Coba sebagai tamu (demo)
        </AppButton>
        <p className="text-xs text-[--text-muted] text-center">
          Mode tamu: data hanya tersimpan sementara di perangkat ini.
        </p>
      </div>
    </div>
  );
}
