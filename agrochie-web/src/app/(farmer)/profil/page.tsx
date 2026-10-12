import type { Metadata } from 'next';
import { ProfilView } from '@/features/profile/ProfilView';

export const metadata: Metadata = { title: 'Profil dan Lahan' };

export default function ProfilPage() {
  return <ProfilView />;
}
