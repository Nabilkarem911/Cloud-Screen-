import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { MediaLibraryClient } from '@/features/media/media-library-client';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function MediaPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'mediaLibrary' });
  const tCommon = await getTranslations({ locale, namespace: 'common' });

  return (
    <main className="space-y-10">
      <header className="space-y-3">
        <p className="vc-page-kicker">{tCommon('assets')}</p>
        <h1 className="vc-page-title">{t('title')}</h1>
        <p className="vc-page-desc max-w-2xl">{t('description')}</p>
      </header>
      <Suspense
        fallback={
          <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
            …
          </div>
        }
      >
        <MediaLibraryClient />
      </Suspense>
    </main>
  );
}
