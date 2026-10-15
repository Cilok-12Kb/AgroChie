import { Suspense } from 'react';
import { ResetPasswordForm } from '@/features/auth/ResetPasswordForm';
// useSearchParams di komponen klien wajib dibungkus Suspense agar build statis tidak gagal.
export default function ResetPasswordPage() { return <Suspense><ResetPasswordForm/></Suspense>; }
