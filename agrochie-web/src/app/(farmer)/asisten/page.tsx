import type { Metadata } from 'next';
import { AsistenView } from '@/features/assistant/AsistenView';

export const metadata: Metadata = { title: 'Asisten AgroChie' };

export default function AsistenPage() {
  return <AsistenView />;
}
