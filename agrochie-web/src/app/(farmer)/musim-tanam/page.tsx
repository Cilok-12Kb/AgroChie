import type { Metadata } from 'next';
import { MusimTanamView } from '@/features/season/MusimTanamView';

export const metadata: Metadata = { title: 'Musim Tanam' };

export default function MusimTanamPage() {
  return <MusimTanamView />;
}
