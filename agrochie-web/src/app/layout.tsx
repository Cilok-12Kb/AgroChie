import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { QueryProvider } from '@/providers/QueryProvider';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800'],
  style: ['normal', 'italic'],
  variable: '--font-jakarta',
});

export const metadata: Metadata = {
  title: 'AgroChie | Smart Farming Workspace',
  description: 'Perencanaan dan pemantauan biaya musim tanam hortikultura.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={jakarta.variable}>
      <body style={{ fontFamily: 'var(--font-jakarta), ui-sans-serif, system-ui, sans-serif' }}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
