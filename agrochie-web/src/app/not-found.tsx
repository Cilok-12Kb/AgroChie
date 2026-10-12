import Link from 'next/link';
import { Leaf, ArrowLeft } from 'lucide-react';
export default function NotFound() {
  return <div className="min-h-screen flex items-center justify-center bg-[#f5f9f5] px-5"><div className="bg-white border border-emerald-100 shadow-sm rounded-3xl max-w-md w-full p-10 text-center"><div className="console-brand-icon mx-auto"><Leaf size={23}/></div><h1 className="font-black text-[70px] text-emerald-800 tracking-tight mt-4 leading-none">404</h1><h2 className="font-extrabold text-slate-900 text-xl mt-4">Halaman tidak ditemukan</h2><p className="text-sm text-slate-500 mt-2 mb-7">Alamat yang Anda buka tidak ada atau sudah dipindahkan.</p><Link href="/beranda" className="console-button console-button-primary"><ArrowLeft size={17}/> Kembali ke beranda</Link></div></div>;
}
