import { Suspense } from 'react';
import { VerifyEmail } from '@/features/auth/VerifyEmail';
// useSearchParams di komponen klien wajib dibungkus Suspense agar build statis tidak gagal.
export default function VerifyEmailPage() { return <Suspense><VerifyEmail/></Suspense>; }
