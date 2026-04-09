import Link from 'next/link';
import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { LoginForm } from '@/features/auth/login-form';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function LoginPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });

  return (
    <div className="relative z-[1] grid min-h-[100dvh] overflow-hidden bg-transparent lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-transparent p-10 ps-12 pe-10 pt-14 lg:flex">
        <div className="relative z-[1] max-w-lg">
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#FF6B00]/90">
            {t('brand')}
          </p>
          <h1 className="mt-8 text-4xl font-semibold tracking-[-0.03em] text-white">{t('title')}</h1>
          <p className="mt-5 max-w-md text-[15px] font-normal leading-relaxed text-white/55">{t('description')}</p>
        </div>
        <p className="relative z-[1] text-xs text-white/35">{t('tagline')}</p>
      </div>

      <div className="relative flex flex-col justify-center bg-transparent px-6 py-14 sm:px-10 lg:px-14">
        <div className="relative z-[1] mx-auto w-full max-w-[420px]">
          <div className="mb-10 lg:hidden">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#FF6B00]/90">{t('brand')}</p>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">{t('title')}</h1>
            <p className="mt-2 text-sm font-normal text-white/55">{t('description')}</p>
          </div>
          <Suspense fallback={<p className="text-sm text-white/45">{t('loading')}</p>}>
            <LoginForm locale={locale} variant="dark" layout="split" />
          </Suspense>
          <p className="mt-10 text-center text-sm text-white/45">
            <Link href={`/${locale}/register`} className="font-medium text-[#FF6B00]/90 hover:underline">
              {t('registerTitle')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
