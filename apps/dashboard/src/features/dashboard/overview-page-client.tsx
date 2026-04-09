'use client';

import { Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { HomeOverview } from '@/features/dashboard/home-overview';
import { AdminOverview } from '@/features/dashboard/admin-overview';
import { useWorkspace } from '@/features/workspace/workspace-context';

type Props = {
  appTitle: string;
  headline: string;
  description: string;
};

export function OverviewPageClient({ appTitle, headline, description }: Props) {
  const t = useTranslations('overviewClient');
  const locale = useLocale();
  const { isSuperAdmin, isLoading } = useWorkspace();
  if (isLoading) {
    return (
      <div className="flex min-h-[48vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-10 w-10 animate-spin text-[#FF6B00]" />
        <p className="text-sm font-medium">{t('loading')}</p>
      </div>
    );
  }
  if (isSuperAdmin) {
    return <AdminOverview locale={locale} />;
  }
  return <HomeOverview appTitle={appTitle} headline={headline} description={description} />;
}
