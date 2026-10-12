import type { Metadata } from 'next';
import { BerandaView } from '@/features/dashboard/BerandaView';

export const metadata: Metadata = { title: 'Beranda' };

export default function BerandaPage() {
  return <BerandaView />;
}
