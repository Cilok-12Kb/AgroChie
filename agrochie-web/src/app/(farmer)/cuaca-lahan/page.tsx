import type { Metadata } from 'next';
import { CuacaLahanView } from '@/features/field/CuacaLahanView';

export const metadata: Metadata = { title: 'Cuaca dan Lahan' };

export default function CuacaLahanPage() {
  return <CuacaLahanView />;
}
