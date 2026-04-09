import { getTranslations } from 'next-intl/server';
import { AdminBreadcrumbBar } from '@/components/admin/admin-breadcrumb-bar';
import { AdminLogsClient } from '@/features/admin/admin-logs-client';

export default async function AdminLogsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'adminLogs' });
  const tb = await getTranslations({ locale, namespace: 'adminBreadcrumb' });
  return (
    <main className="space-y-6">
      <AdminBreadcrumbBar
        ariaLabel={tb('ariaLabel')}
        items={[
          { href: `/${locale}/overview`, label: tb('root') },
          { label: tb('logs') },
        ]}
      />
      <header className="space-y-1 border-b border-[#FF6B00]/10 pb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#94A3B8] dark:text-[#FF6B00]">
          {t('kicker')}
        </p>
        <h1 className="text-xl font-semibold tracking-tight">{t('title')}</h1>
      </header>
      <AdminLogsClient />
    </main>
  );
}
