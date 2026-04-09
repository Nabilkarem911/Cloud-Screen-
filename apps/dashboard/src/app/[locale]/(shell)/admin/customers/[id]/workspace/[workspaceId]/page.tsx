import { getTranslations } from 'next-intl/server';
import { AdminBreadcrumbBar } from '@/components/admin/admin-breadcrumb-bar';
import { AdminCustomerWorkspaceClient } from '@/features/admin/admin-customer-workspace-client';

type Props = {
  params: Promise<{ locale: string; id: string; workspaceId: string }>;
};

export default async function AdminCustomerWorkspacePage({ params }: Props) {
  const { locale, id, workspaceId } = await params;
  const t = await getTranslations({ locale, namespace: 'adminCustomerWorkspace' });
  const tb = await getTranslations({ locale, namespace: 'adminBreadcrumb' });

  return (
    <main className="space-y-6">
      <AdminBreadcrumbBar
        ariaLabel={tb('ariaLabel')}
        items={[
          { href: `/${locale}/overview`, label: tb('root') },
          { href: `/${locale}/admin/customers`, label: tb('customers') },
          { href: `/${locale}/admin/customers/${id}`, label: tb('customerProfile') },
          { label: tb('branchWorkspace') },
        ]}
      />
      <header className="space-y-1 border-b border-[#FF6B00]/10 pb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#94A3B8] dark:text-[#FF6B00]">
          {t('kicker')}
        </p>
        <h1 className="text-xl font-semibold tracking-tight">{t('pageTitle')}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{t('pageDescription')}</p>
      </header>
      <AdminCustomerWorkspaceClient customerId={id} workspaceId={workspaceId} />
    </main>
  );
}
