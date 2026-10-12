import type { Metadata } from 'next';
import { Nunito } from 'next/font/google';
import { QueryProvider } from '@/providers/QueryProvider';
import './globals.css';

const nunito = Nunito({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-nunito',
  weight: ['400', '500', '600', '700', '800', '900'],
});

export const metadata: Metadata = {
  title: {
    default: 'AgroChie — Rencanakan biaya satu musim tanam',
    template: '%s · AgroChie',
  },
  description:
    'Perencanaan biaya musim tanam untuk petani hortikultura. Tahu berapa biaya, kapan uang dibutuhkan, dan apakah modal cukup hingga panen.',
  keywords: ['pertanian', 'biaya tanam', 'petani', 'cabai', 'tomat', 'bawang', 'hortikultura'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className={`${nunito.variable} font-sans antialiased`}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
