import type { Metadata } from 'next';
import { RisikoKreditView } from '@/features/credit/RisikoKreditView';

export const metadata: Metadata = { title: 'Risiko dan Kredit' };

export default function RisikoKreditPage() {
  return <RisikoKreditView />;
}
