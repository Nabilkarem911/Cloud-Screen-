'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Activity, Cpu, HardDrive, Radio, Server } from 'lucide-react';
import { AdminCosmicLoader } from '@/components/admin/admin-cosmic-loader';
import { toast } from 'sonner';
import { apiFetch } from '@/features/auth/session';

type Stats = {
  revenueUsdPlaceholder: number;
  totalConnectedScreens: number;
  totalActiveUsers: number;
  totalWorkspaces: number;
  realtimeSocketConnections: number;
  server: {
    loadAvg1m: number;
    memoryUsedBytes: number;
    memoryTotalBytes: number;
    hostname: string;
    platform: string;
  };
};

function formatBytes(n: number, locale: string): string {
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  if (n < 1024) return `${nf.format(n)} B`;
  if (n < 1024 * 1024) return `${nf.format(n / 1024)} KB`;
  if (n < 1024 * 1024 * 1024) return `${nf.format(n / (1024 * 1024))} MB`;
  return `${nf.format(n / (1024 * 1024 * 1024))} GB`;
}

export function AdminSystemHealthClient() {
  const locale = useLocale();
  const t = useTranslations('adminSystemHealth');
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const res = await apiFetch('/admin/stats');
    if (!res.ok) {
      toast.error(t('loadFailed'));
      setError(t('failed'));
      return;
    }
    setStats((await res.json()) as Stats);
    setError(null);
  };

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 10_000);
    return () => window.clearInterval(t);
  }, []);

  const memPct =
    stats && stats.server.memoryTotalBytes > 0
      ? Math.round(
          (100 * stats.server.memoryUsedBytes) / stats.server.memoryTotalBytes,
        )
      : 0;

  if (error && !stats) {
    return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  }

  if (!stats) {
    return <AdminCosmicLoader label={t('loading')} />;
  }

  const cards = [
    {
      label: t('cards.sockets'),
      value: new Intl.NumberFormat(locale).format(stats.realtimeSocketConnections),
      sub: t('cards.socketsSub'),
      icon: Radio,
      accent: 'from-cyan-500 to-blue-700',
    },
    {
      label: t('cards.cpu'),
      value: new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(stats.server.loadAvg1m),
      sub: `${stats.server.hostname} · ${stats.server.platform}`,
      icon: Cpu,
      accent: 'from-[#FF6B00] to-[#0c1220]',
    },
    {
      label: t('cards.memory'),
      value: `${memPct}%`,
      sub: `${formatBytes(stats.server.memoryUsedBytes, locale)} / ${formatBytes(stats.server.memoryTotalBytes, locale)}`,
      icon: HardDrive,
      accent: 'from-emerald-500 to-teal-800',
    },
    {
      label: t('cards.onlineScreens'),
      value: new Intl.NumberFormat(locale).format(stats.totalConnectedScreens),
      sub: `${new Intl.NumberFormat(locale).format(stats.totalActiveUsers)} ${t('users')} · ${new Intl.NumberFormat(locale).format(stats.totalWorkspaces)} ${t('workspaces')}`,
      icon: Activity,
      accent: 'from-amber-400 to-[#FF6B00]',
    },
  ];

  return (
    <div className="space-y-8">
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="vc-card-surface rounded-3xl border border-[#FF6B00]/15 p-6 sm:p-8"
      >
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF6B00] to-amber-600 shadow-lg">
            <Server className="h-6 w-6 text-amber-950" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{t('title')}</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {t('description')}
            </p>
            <p className="mt-4 rounded-xl border border-dashed border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-950 dark:text-amber-100/85">
              {t('revenueDisclaimer')}
            </p>
          </div>
        </div>
      </motion.section>

      <section className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {cards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 * i }}
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
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${c.accent} shadow-lg`}
              >
                <c.icon className="h-6 w-6 text-white" strokeWidth={1.75} />
              </div>
            </div>
          </motion.div>
        ))}
      </section>
    </div>
  );
}
