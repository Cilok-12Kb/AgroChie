import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Leaf,
  ChevronRight,
  DollarSign,
  Calendar,
  CheckSquare,
  ArrowRight,
  Sprout,
  BarChart2,
  BookOpen,
  Star,
} from 'lucide-react';
import { AppButton } from '@/components/ui/AppButton';
import { LandingCalculator } from '@/features/dashboard/LandingCalculator';

export const metadata: Metadata = {
  title: 'AgroChie — Tahu biaya tanam sebelum mulai menanam',
};

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Isi profil lahan',
    desc: 'Masukkan komoditas, luas lahan, kondisi tanah, dan modal tersedia.',
    icon: Sprout,
  },
  {
    step: '02',
    title: 'Lihat rencana dan kalender biaya',
    desc: 'Estimasi total biaya per musim, jadwal pengeluaran mingguan, dan peringatan kekurangan modal.',
    icon: BarChart2,
  },
  {
    step: '03',
    title: 'Catat musim dan panen',
    desc: 'Dokumentasikan pengeluaran dan hasil panen. Catatan yang lengkap membantu pengajuan pinjaman.',
    icon: BookOpen,
  },
];

const BENEFITS = [
  {
    icon: DollarSign,
    title: 'Berapa biaya?',
    desc: 'Perkiraan total biaya satu musim tanam berdasarkan komoditas, luas lahan, dan kondisi cuaca serta tanah.',
  },
  {
    icon: Calendar,
    title: 'Kapan uang keluar?',
    desc: 'Kalender pengeluaran mingguan agar Anda bisa menyiapkan modal tepat waktu, bukan mendadak.',
  },
  {
    icon: CheckSquare,
    title: 'Apa yang perlu dilakukan minggu ini?',
    desc: 'Pengingat cek lahan dan daftar kegiatan perawatan sesuai fase musim tanam berjalan.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[--background] flex flex-col">
      {/* ─── Navbar ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-[--surface]/95 backdrop-blur-md border-b border-[--border]">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-[--primary] flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              <Leaf size={20} className="text-white" />
            </div>
            <span className="font-extrabold text-xl text-[--text]">AgroChie</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <a href="#cara-kerja" className="text-sm font-semibold text-[--text-muted] hover:text-[--primary] transition-colors">
              Cara kerja
            </a>
            <a href="#manfaat" className="text-sm font-semibold text-[--text-muted] hover:text-[--primary] transition-colors">
              Manfaat
            </a>
            <Link href="/masuk" className="text-sm font-semibold text-[--primary] hover:underline">
              Masuk
            </Link>
          </nav>

          <Link href="/daftar">
            <AppButton size="sm" rightIcon={<ChevronRight size={16} />}>
              Mulai sekarang
            </AppButton>
          </Link>
        </div>
      </header>

      {/* ─── Hero ────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full bg-[--primary-soft] opacity-30 blur-3xl" />
          <div className="absolute top-20 right-0 w-[300px] h-[300px] rounded-full bg-green-100 opacity-20 blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 md:px-8 py-16 md:py-24 lg:py-32">
          <div className="max-w-3xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-[--primary-soft] text-[--primary-ink] text-sm font-bold px-4 py-1.5 rounded-full mb-6">
              <Star size={14} className="text-[--primary]" />
              Perencanaan keuangan untuk petani hortikultura
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-[--text] leading-tight mb-6">
              Tahu biaya tanam{' '}
              <span className="text-[--primary] relative">
                sebelum mulai menanam.
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 400 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M2 8C100 3 200 10 398 4" stroke="#176b43" strokeWidth="3" strokeLinecap="round" opacity="0.3"/>
                </svg>
              </span>
            </h1>

            <p className="text-lg md:text-xl text-[--text-muted] leading-relaxed mb-10 max-w-2xl">
              AgroChie membantu petani cabai, tomat, dan bawang merah merencanakan biaya satu musim, 
              memantau pengeluaran, dan mempersiapkan dokumen untuk pengajuan pinjaman.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link href="/daftar">
                <AppButton size="lg" rightIcon={<ArrowRight size={18} />}>
                  Mulai gratis
                </AppButton>
              </Link>
              <Link href="/masuk">
                <AppButton size="lg" variant="outline">
                  Masuk ke akun
                </AppButton>
              </Link>
            </div>

            <p className="mt-4 text-sm text-[--text-muted]">
              Tersedia demo tanpa akun · Data tersimpan lokal
            </p>
          </div>
        </div>
      </section>

      {/* ─── Calculator ──────────────────────────────────────── */}
      <section className="bg-[--surface-muted] border-y border-[--border] py-16">
        <div className="max-w-6xl mx-auto px-4 md:px-8">
          <div className="max-w-2xl mx-auto text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-[--text] mb-3">
              Hitung perkiraan biaya musim
            </h2>
            <p className="text-[--text-muted]">
              Pilih komoditas dan luas lahan, lalu klik tombol untuk melihat estimasi biaya.
            </p>
          </div>
          <LandingCalculator />
        </div>
      </section>

      {/* ─── Benefits ────────────────────────────────────────── */}
      <section id="manfaat" className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 md:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-[--text] mb-3">
              Tiga hal yang akan Anda ketahui
            </h2>
            <p className="text-[--text-muted] max-w-lg mx-auto">
              Informasi yang selama ini sulit didapat petani, kini tersedia dalam genggaman.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {BENEFITS.map((benefit) => {
              const Icon = benefit.icon;
              return (
                <div
                  key={benefit.title}
                  className="bg-[--surface] rounded-2xl border border-[--border] p-6 hover:shadow-md hover:-translate-y-1 transition-all duration-200"
                >
                  <div className="w-12 h-12 rounded-2xl bg-[--primary-soft] flex items-center justify-center mb-4">
                    <Icon size={24} className="text-[--primary]" />
                  </div>
                  <h3 className="text-lg font-bold text-[--text] mb-2">{benefit.title}</h3>
                  <p className="text-sm text-[--text-muted] leading-relaxed">{benefit.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── How it works ────────────────────────────────────── */}
      <section id="cara-kerja" className="bg-[--surface-muted] border-y border-[--border] py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 md:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-[--text] mb-3">
              Cara kerja AgroChie
            </h2>
            <p className="text-[--text-muted]">Tiga langkah sederhana dari profil hingga riwayat panen.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map((step, idx) => {
              const Icon = step.icon;
              return (
                <div key={step.step} className="flex flex-col items-center text-center gap-4 relative">
                  {idx < HOW_IT_WORKS.length - 1 && (
                    <div className="hidden md:block absolute top-8 left-[calc(50%+40px)] w-[calc(100%-80px)] h-px border-t-2 border-dashed border-[--border]" />
                  )}
                  <div className="w-16 h-16 rounded-2xl bg-[--primary] flex items-center justify-center shadow-md">
                    <Icon size={28} className="text-white" />
                  </div>
                  <div className="text-xs font-bold text-[--primary] tracking-widest">{step.step}</div>
                  <h3 className="font-bold text-lg text-[--text]">{step.title}</h3>
                  <p className="text-sm text-[--text-muted] leading-relaxed max-w-xs">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── CTA ─────────────────────────────────────────────── */}
      <section className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 md:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-[--text] mb-4">
            Siap merencanakan musim tanam berikutnya?
          </h2>
          <p className="text-[--text-muted] mb-8 max-w-lg mx-auto">
            Bergabung dan mulai isi profil lahan Anda sekarang.
          </p>
          <Link href="/daftar">
            <AppButton size="lg" rightIcon={<ArrowRight size={18} />}>
              Daftar gratis sekarang
            </AppButton>
          </Link>
        </div>
      </section>

      {/* ─── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-[--border] bg-[--surface-muted] py-8">
        <div className="max-w-6xl mx-auto px-4 md:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[--primary] flex items-center justify-center">
                <Leaf size={14} className="text-white" />
              </div>
              <span className="font-bold text-[--text]">AgroChie</span>
            </div>
            <p className="text-xs text-[--text-muted] text-center max-w-md">
              <strong>Prototipe · Data contoh.</strong> Perkiraan biaya berbasis aturan dan simulasi, bukan prediksi AI. 
              Angka bukan jaminan hasil panen atau kelayakan pinjaman. 
              Keputusan kredit ditentukan bank/koperasi, bukan aplikasi ini.
            </p>
            <p className="text-xs text-[--text-muted]">© 2026 AgroChie</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
