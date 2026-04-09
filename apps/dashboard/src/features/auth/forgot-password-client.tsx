'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/features/auth/session';

export function ForgotPasswordClient() {
  const t = useTranslations('forgotPasswordClient');
  const locale = useLocale();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const emailParam = searchParams.get('email');

  const [email, setEmail] = useState(emailParam ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [pending, setPending] = useState(false);

  const requestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    try {
      const res = await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        toast.error(t('requestFailed'));
        return;
      }
      toast.success(t('requestSent'));
    } finally {
      setPending(false);
    }
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !email) {
      toast.error(t('missingTokenOrEmail'));
      return;
    }
    setPending(true);
    try {
      const res = await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          email,
          token,
          newPassword,
        }),
      });
      if (!res.ok) {
        toast.error(t('resetFailed'));
        return;
      }
      toast.success(t('passwordUpdated'));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-4 py-12">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(10,15,29,0.45),transparent_55%)]"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#030712] via-[#0a0614] to-[#030712]" aria-hidden />

      <section className="relative z-[1] w-full max-w-md">
        <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-px backdrop-blur-2xl dark:bg-black/25">
          <div className="rounded-[1.65rem] bg-gradient-to-br from-white/[0.09] to-white/[0.02] px-8 py-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#FF6B00]/90">{t('brand')}</p>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
              {token ? t('setNewPasswordTitle') : t('forgotPasswordTitle')}
            </h1>
            <p className="mt-3 text-sm text-white/60">
              {token
                ? t('setNewPasswordDescription')
                : t('forgotPasswordDescription')}
            </p>

            {!token ? (
              <form className="mt-8 space-y-4" onSubmit={(e) => void requestReset(e)}>
                <div className="space-y-2">
                  <Label className="text-white/80">{t('email')}</Label>
                  <Input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="rounded-xl border-white/15 bg-white/5 text-white"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={pending}
                  className="w-full rounded-2xl bg-gradient-to-r from-[#FF6B00] to-[#CC4400] font-semibold text-white"
                >
                  {t('sendResetLink')}
                </Button>
              </form>
            ) : (
              <form className="mt-8 space-y-4" onSubmit={(e) => void resetPassword(e)}>
                <div className="space-y-2">
                  <Label className="text-white/80">{t('email')}</Label>
                  <Input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="rounded-xl border-white/15 bg-white/5 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/80">{t('newPassword')}
                  </Label>
                  <Input
                    required
                    type="password"
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="rounded-xl border-white/15 bg-white/5 text-white"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={pending}
                  className="w-full rounded-2xl bg-gradient-to-r from-[#FF6B00] to-amber-500 font-semibold text-amber-950"
                >
                  {t('updatePassword')}
                </Button>
              </form>
            )}

            <p className="mt-8 text-center text-sm text-white/50">
              <Link href={`/${locale}/login`} className="font-semibold text-[#FF6B00] underline-offset-4 hover:underline">
                {t('backToSignIn')}
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
