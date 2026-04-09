import { getTranslations } from 'next-intl/server';
import { BillingClient } from '@/features/billing/billing-client';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function BillingPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'billingPage' });
  const tCommon = await getTranslations({ locale, namespace: 'common' });

  return (
    <main className="space-y-10">
      <header className="space-y-3">
        <p className="vc-page-kicker">{tCommon('saas')}</p>
        <h1 className="vc-page-title">{t('title')}</h1>
        <p className="vc-page-desc max-w-2xl">{t('description')}</p>
      </header>
      <BillingClient />
    </main>
  );
}
