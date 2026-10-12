import Link from 'next/link';
import { Leaf } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[--surface-muted] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-xl bg-[--primary] flex items-center justify-center shadow group-hover:scale-105 transition-transform">
              <Leaf size={22} className="text-white" />
            </div>
            <span className="font-extrabold text-2xl text-[--text]">AgroChie</span>
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
