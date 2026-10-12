import type { Metadata } from 'next';
import { KalenderUangView } from '@/features/cashflow/KalenderUangView';

export const metadata: Metadata = { title: 'Kalender Uang' };

export default function KalenderUangPage() {
  return <KalenderUangView />;
}
