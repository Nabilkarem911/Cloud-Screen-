import { getTranslations } from 'next-intl/server';
import { OverviewPageClient } from '@/features/dashboard/overview-page-client';

type Props = { params: Promise<{ locale: string }> };

export default async function OverviewPage({ params }: Props) {
  const { locale } = await params;
  const tApp = await getTranslations({ locale, namespace: 'app' });
  const tHero = await getTranslations({ locale, namespace: 'hero' });

  return (
    <OverviewPageClient
      appTitle={tApp('title')}
      headline={tHero('headline')}
      description={tHero('description')}
    />
  );
}
