import { getTranslations } from 'next-intl/server';
import { AdminBreadcrumbBar } from '@/components/admin/admin-breadcrumb-bar';
import { AdminFleetClient } from '@/features/admin/admin-fleet-client';

export default async function AdminFleetPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'adminFleetClient' });
  const tCommon = await getTranslations({ locale, namespace: 'common' });
  const tb = await getTranslations({ locale, namespace: 'adminBreadcrumb' });

  return (
    <main className="space-y-10">
      <AdminBreadcrumbBar
        ariaLabel={tb('ariaLabel')}
        items={[
          { href: `/${locale}/overview`, label: tb('root') },
          { label: tb('fleet') },
        ]}
      />
      <header className="space-y-3">
        <p className="vc-page-kicker text-[#94A3B8] dark:text-[#FF6B00]">{tCommon('system')}</p>
        <h1 className="vc-page-title">{t('pageTitle')}</h1>
        <p className="vc-page-desc max-w-2xl">{t('pageDescription')}</p>
      </header>
      <AdminFleetClient />
    </main>
  );
}
