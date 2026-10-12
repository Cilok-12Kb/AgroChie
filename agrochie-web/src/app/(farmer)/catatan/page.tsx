import type { Metadata } from 'next';
import { CatatanView } from '@/features/expense/CatatanView';

export const metadata: Metadata = { title: 'Catatan Pengeluaran' };

export default function CatatanPage() {
  return <CatatanView />;
}
