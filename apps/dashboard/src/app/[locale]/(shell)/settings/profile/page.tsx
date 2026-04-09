import { getTranslations } from 'next-intl/server';
import { SettingsProfileClient } from '@/features/settings/settings-profile-client';

type Props = { params: Promise<{ locale: string }> };

export default async function SettingsProfilePage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'settingsPages' });
  return (
    <main className="space-y-6">
      <header className="space-y-1 border-b border-[#0F1729]/15 pb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#0F1729] dark:text-[#FFBB88]">
          {t('profileKicker')}
        </p>
        <h1 className="text-xl font-semibold tracking-tight">{t('profileTitle')}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {t('profileDescription')}
        </p>
      </header>
      <SettingsProfileClient />
    </main>
  );
}
