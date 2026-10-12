import type { Metadata } from 'next';
import { PrediksiView } from '@/features/prediction/PrediksiView';

export const metadata: Metadata = { title: 'Prediksi Musim' };

export default function PrediksiPage() {
  return <PrediksiView />;
}
