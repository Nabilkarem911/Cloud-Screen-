import { getTranslations } from 'next-intl/server';
import { StudioEditorClient } from '@/features/studio/studio-editor-client';

type PageProps = { params: Promise<{ locale: string }> };

export default async function StudioPage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'studio' });
  const tCommon = await getTranslations({ locale, namespace: 'common' });

  return (
    <main className="space-y-10">
      <header className="space-y-3">
        <p className="vc-page-kicker">{tCommon('canvas')}</p>
        <h1 className="vc-page-title">{t('title')}</h1>
        <p className="vc-page-desc max-w-2xl">{t('description')}</p>
      </header>
      <StudioEditorClient />
    </main>
  );
}
