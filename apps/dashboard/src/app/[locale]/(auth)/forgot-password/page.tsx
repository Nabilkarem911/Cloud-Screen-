import { Suspense } from 'react';
import { ForgotPasswordClient } from '@/features/auth/forgot-password-client';

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-[#030712]" />}>
      <ForgotPasswordClient />
    </Suspense>
  );
}
