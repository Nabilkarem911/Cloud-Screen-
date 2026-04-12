'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { HardDrive, Link2, MonitorSmartphone, Activity } from 'lucide-react';
import { AdminCosmicLoader } from '@/components/admin/admin-cosmic-loader';
import { toast } from 'sonner';
import { apiFetch } from '@/features/auth/session';
import { ICON_STROKE } from '@/lib/icon-stroke';

type AdminOverview = {
  screensOnline: number;
  screensTotal: number;
  storageUsedBytes: number;
  storageQuotaBytes: number | null;
  pairingPendingActive: number;
  healthOnline: number;
  healthOffline: number;
  healthMaintenance: number;
  healthCacheMode: number;
};

type StatsPayload = {
  adminOverview?: AdminOverview;
};

function formatBytes(n: number, locale: string): string {
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  if (n < 1024) return `${nf.format(n)} B`;
  if (n < 1024 * 1024) return `${nf.format(n / 1024)} KB`;
  if (n < 1024 * 1024 * 1024) return `${nf.format(n / (1024 * 1024))} MB`;
  return `${nf.format(n / (1024 * 1024 * 1024))} GB`;
}

export function AdminHomeOverviewClient() {
  const locale = useLocale();
  const t = useTranslations('adminHomeOverview');
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch('/admin/stats');
    if (!res.ok) {
      toast.error(t('loadFailed'));
      setError(t('failed'));
      return;
    }
    const body = (await res.json()) as StatsPayload;
    if (!body.adminOverview) {
      setError(t('failed'));
      return;
    }
    setOverview(body.adminOverview);
    setError(null);
  }, [t]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(id);
  }, [load]);

  if (error && !overview) {
    return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  }

  if (!overview) {
    return <AdminCosmicLoader label={t('loading')} />;
  }

  const nf = (n: number) => new Intl.NumberFormat(locale).format(n);
  const storageSub =
    overview.storageQuotaBytes != null && overview.storageQuotaBytes > 0
      ? t('storageSubQuota', {
          used: formatBytes(overview.storageUsedBytes, locale),
          quota: formatBytes(overview.storageQuotaBytes, locale),
        })
      : t('storageSubNoQuota', {
          used: formatBytes(overview.storageUsedBytes, locale),
        });

  const cards = [
    {
      key: 'screens',
      label: t('cards.screens'),
      value: t('cards.screensValue', {
        active: nf(overview.screensOnline),
        total: nf(overview.screensTotal),
      }),
      sub: t('cards.screensSub'),
      icon: MonitorSmartphone,
    },
    {
      key: 'storage',
      label: t('cards.storage'),
      value: formatBytes(overview.storageUsedBytes, locale),
      sub: storageSub,
      icon: HardDrive,
    },
    {
      key: 'pairing',
      label: t('cards.pairing'),
      value: nf(overview.pairingPendingActive),
      sub: t('cards.pairingSub'),
      icon: Link2,
    },
    {
      key: 'health',
      label: t('cards.health'),
      value: t('cards.healthValue', {
        online: nf(overview.healthOnline),
        offline: nf(overview.healthOffline),
      }),
      sub: t('cards.healthSub', {
        maintenance: nf(overview.healthMaintenance),
        cache: nf(overview.healthCacheMode),
      }),
      icon: Activity,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      {cards.map((c, i) => (
        <motion.div
          key={c.key}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 * i }}
          className="vc-card-surface relative overflow-hidden rounded-3xl p-7"
        >
          <div className="absolute -end-6 -top-6 h-24 w-24 rounded-full bg-[#FF6B00]/10 blur-2xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="vc-page-kicker">{c.label}</p>
              <p className="mt-3 font-mono-nums text-2xl font-bold tracking-tight sm:text-3xl">
                {c.value}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{c.sub}</p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF6B00] to-amber-600 shadow-lg">
              <c.icon className="h-6 w-6 text-amber-950" strokeWidth={ICON_STROKE} />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
