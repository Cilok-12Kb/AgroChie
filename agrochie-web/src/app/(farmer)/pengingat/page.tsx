import type { Metadata } from 'next';
import { PengingatView } from '@/features/reminders/PengingatView';

export const metadata: Metadata = { title: 'Pengingat Cek Lahan' };

export default function PengingatPage() {
  return <PengingatView />;
}
