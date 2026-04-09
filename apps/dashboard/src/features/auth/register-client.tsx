'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch, setStoredAccessToken } from '@/features/auth/session';
import { useWorkspace } from '@/features/workspace/workspace-context';
import { COUNTRIES, guessCountryCode } from '@/lib/countries';

type Step = 'form' | 'otp';

export function RegisterClient() {
  const t = useTranslations('registerClient');
  const locale = useLocale();
  const router = useRouter();
  const { refreshWorkspaces } = useWorkspace();

  const [step, setStep] = useState<Step>('form');
  const [pending, setPending] = useState(false);
  const [email, setEmail] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('US');
  const [city, setCity] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');

  useEffect(() => {
    setCountry(guessCountryCode());
  }, []);

  const dial = useMemo(() => COUNTRIES.find((c) => c.code === country)?.dial ?? '', [country]);

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    try {
      const res = await apiFetch('/auth/register/start', {
        method: 'POST',
        body: JSON.stringify({
          email,
          businessName,
          fullName,
          phone: `${dial} ${phone}`.trim(),
          country,
          city: city || undefined,
          password,
          locale,
        }),
      });
      if (res.status === 409) {
        toast.error(t('emailExists'));
        return;
      }
      if (!res.ok) {
        toast.error(t('registerFailed'));
        return;
      }
      toast.success(t('otpSent'));
      setStep('otp');
    } finally {
      setPending(false);
    }
  };

  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    try {
      const res = await apiFetch('/auth/register/verify', {
        method: 'POST',
        body: JSON.stringify({ email, code: otp }),
      });
      if (!res.ok) {
        toast.error(t('invalidCode'));
        return;
      }
      const payload = (await res.json()) as {
        accessToken?: string;
        workspaces?: Array<{ id: string }>;
      };
      if (payload.accessToken) setStoredAccessToken(payload.accessToken);
      const ws = payload.workspaces?.[0]?.id ?? null;
      await refreshWorkspaces(ws);
      toast.success(t('welcome'));
      router.push(`/${locale}/media` as Route);
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-4 py-12">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(10,15,29,0.45),transparent_55%),radial-gradient(ellipse_80%_60%_at_100%_50%,rgba(255, 107, 0,0.12),transparent_50%)]"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#030712] via-[#0a0614] to-[#030712]" aria-hidden />

      <section className="relative z-[1] w-full max-w-lg">
        <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-px shadow-[0_25px_80px_-20px_rgba(10,15,29,0.45)] backdrop-blur-2xl dark:bg-black/25">
          <div className="rounded-[1.65rem] bg-gradient-to-br from-white/[0.09] to-white/[0.02] px-8 py-10 sm:px-10 sm:py-12">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#FF6B00]/90">{t('brand')}</p>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {step === 'form' ? t('createWorkspaceTitle') : t('verifyEmailTitle')}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-white/60">
              {step === 'form'
                ? t('formDescription')
                : t('otpDescription', { email })}
            </p>

            {step === 'form' ? (
              <form className="mt-8 space-y-4" onSubmit={(e) => void submitForm(e)}>
                <div className="space-y-2">
                  <Label className="text-white/80">{t('businessName')}</Label>
                  <Input
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="rounded-xl border-white/15 bg-white/5 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/80">{t('yourName')}</Label>
                  <Input
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="rounded-xl border-white/15 bg-white/5 text-white"
                  />
                </div>
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
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-white/80">{t('country')}</Label>
                    <select
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="flex h-10 w-full rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-white outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-[#FF6B00]/40"
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code} className="bg-[#0a0614]">
                          {c.flag} {c.name} ({c.dial})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white/80">{t('phone')}</Label>
                    <div className="flex gap-2">
                      <span className="flex h-10 min-w-[3.5rem] items-center justify-center rounded-xl border border-white/15 bg-white/5 text-xs text-white/80">
                        {dial}
                      </span>
                      <Input
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 14))}
                        className="rounded-xl border-white/15 bg-white/5 text-white"
                        placeholder={t('phonePlaceholder')}
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-white/80">{t('city')}</Label>
                  <Input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="rounded-xl border-white/15 bg-white/5 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/80">{t('password')}</Label>
                  <Input
                    required
                    type="password"
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="rounded-xl border-white/15 bg-white/5 text-white"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={pending}
                  className="w-full rounded-2xl bg-gradient-to-r from-[#FF6B00] to-[#CC4400] font-semibold text-white shadow-lg shadow-[#0F1729]/30"
                >
                  {t('continue')}
                </Button>
              </form>
            ) : (
              <form className="mt-8 space-y-4" onSubmit={(e) => void submitOtp(e)}>
                <div className="space-y-2">
                  <Label className="text-white/80">{t('code6Digits')}</Label>
                  <Input
                    required
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="rounded-xl border-white/15 bg-white/5 text-center font-mono text-2xl tracking-[0.4em] text-white"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={pending || otp.length !== 6}
                  className="w-full rounded-2xl bg-gradient-to-r from-[#FF6B00] to-amber-500 font-semibold text-amber-950"
                >
                  {t('activateAccount')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-white/70"
                  onClick={() => setStep('form')}
                >
                  {t('back')}
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
