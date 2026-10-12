import type { Metadata } from 'next';
import { RencanaBiayaView } from '@/features/budget/RencanaBiayaView';

export const metadata: Metadata = { title: 'Rencana Biaya' };

export default function RencanaBiayaPage() {
  return <RencanaBiayaView />;
}
