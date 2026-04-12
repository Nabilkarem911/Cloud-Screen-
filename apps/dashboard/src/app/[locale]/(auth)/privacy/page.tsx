import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legal' });

  return (
    <div className="mx-auto max-w-2xl px-6 py-16 text-white/90">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#FF6B00]/90">
        {t('privacyLink')}
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">{t('privacyTitle')}</h1>
      <p className="mt-4 text-sm leading-relaxed text-white/60">{t('privacyLead')}</p>
      <div className="mt-10 space-y-5 text-[15px] leading-relaxed text-white/75">
        <p>{t('privacyP1')}</p>
        <p>{t('privacyP2')}</p>
        <p>{t('privacyP3')}</p>
      </div>
      <p className="mt-12 text-center text-sm text-white/45">
        <Link href={`/${locale}/login`} className="font-medium text-[#FF6B00]/90 hover:underline">
          {t('backToLogin')}
        </Link>
      </p>
    </div>
  );
}
