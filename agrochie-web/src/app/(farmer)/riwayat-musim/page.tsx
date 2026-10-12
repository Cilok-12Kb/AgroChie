import type { Metadata } from 'next';
import { RiwayatMusimView } from '@/features/history/RiwayatMusimView';

export const metadata: Metadata = { title: 'Riwayat Musim' };

export default function RiwayatMusimPage() {
  return <RiwayatMusimView />;
}
