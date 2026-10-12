import Link from 'next/link';
import { Leaf, ArrowLeft } from 'lucide-react';
import { AppButton } from '@/components/ui/AppButton';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[--surface-muted] flex flex-col items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-sm">
        <div className="w-20 h-20 rounded-3xl bg-[--primary] flex items-center justify-center mx-auto shadow-lg">
          <Leaf size={36} className="text-white" />
        </div>
        <div>
          <h1 className="text-6xl font-extrabold text-[--primary]">404</h1>
          <h2 className="text-xl font-bold text-[--text] mt-2">Halaman tidak ditemukan</h2>
          <p className="text-sm text-[--text-muted] mt-1.5">
            Halaman yang Anda cari tidak ada atau sudah dipindahkan.
          </p>
        </div>
        <Link href="/">
          <AppButton leftIcon={<ArrowLeft size={16} />} variant="outline">
            Kembali ke beranda
          </AppButton>
        </Link>
      </div>
    </div>
  );
}
