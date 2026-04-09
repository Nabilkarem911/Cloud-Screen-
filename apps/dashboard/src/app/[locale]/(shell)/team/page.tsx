import { getTranslations } from 'next-intl/server';
import { TeamClient } from '@/features/team/team-client';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function TeamPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'teamPage' });
  const tCommon = await getTranslations({ locale, namespace: 'common' });

  return (
    <main className="space-y-10">
      <header className="space-y-3">
        <p className="vc-page-kicker">{tCommon('workspace')}</p>
        <h1 className="vc-page-title">{t('title')}</h1>
        <p className="vc-page-desc max-w-2xl">{t('description')}</p>
      </header>
      <TeamClient />
    </main>
  );
}
