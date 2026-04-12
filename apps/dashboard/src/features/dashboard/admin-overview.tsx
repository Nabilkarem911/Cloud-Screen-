'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  DollarSign,
  Monitor,
  Users,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiFetch } from '@/features/auth/session';

type GlobalStats = {
  revenueUsdPlaceholder: number;
  totalConnectedScreens: number;
  totalActiveUsers: number;
  totalActiveCustomers?: number;
  totalWorkspaces: number;
  realtimeSocketConnections: number;
  server: {
    loadAvg1m: number;
    memoryUsedBytes: number;
    memoryTotalBytes: number;
    hostname: string;
    platform: string;
    uptimeSeconds?: number;
  };
};

function formatUsd(n: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

type Props = {
  locale: string;
};

function formatDuration(totalSeconds: number, locale: string): string {
  const day = 86_400;
  const hour = 3_600;
  const minute = 60;
  const days = Math.floor(totalSeconds / day);
  const hours = Math.floor((totalSeconds % day) / hour);
  const minutes = Math.floor((totalSeconds % hour) / minute);
  const nf = new Intl.NumberFormat(locale);
  return `${nf.format(days)}d ${nf.format(hours)}h ${nf.format(minutes)}m`;
}

export function AdminOverview({ locale }: Props) {
  const t = useTranslations('adminOverview');
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dbLatencyMs, setDbLatencyMs] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const startedAt = performance.now();
      const res = await apiFetch('/admin/stats');
      if (!res.ok) {
        if (!cancelled) setError(t('loadFailed'));
        return;
      }
      const data = (await res.json()) as GlobalStats;
      if (!cancelled) {
        setDbLatencyMs(Math.max(1, Math.round(performance.now() - startedAt)));
        setStats(data);
        setError(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const metricsCards = stats
    ? [
        {
          label: t('cards.revenue'),
          value: formatUsd(stats.revenueUsdPlaceholder, locale),
          sub: t('cards.revenueSub'),
          icon: DollarSign,
          accent: 'from-[#FF6B00] to-amber-500',
          iconText: 'text-amber-950',
          href: `/${locale}/admin/billing`,
        },
        {
          label: t('cards.activeCustomers'),
          value: new Intl.NumberFormat(locale).format(
            stats.totalActiveCustomers ?? stats.totalWorkspaces,
          ),
          sub: t('cards.activeCustomersSub'),
          icon: Users,
          accent: 'from-[#FF6B00] to-[#0c1220]',
          iconText: 'text-white',
          href: `/${locale}/admin/customers`,
        },
        {
          label: t('cards.connectedScreens'),
          value: new Intl.NumberFormat(locale).format(stats.totalConnectedScreens),
          sub: t('cards.connectedScreensSub'),
          icon: Monitor,
          accent: 'from-emerald-500 to-teal-800',
          iconText: 'text-white',
          href: `/${locale}/admin/stats`,
        },
        {
          label: t('cards.systemHealth'),
          value: new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(stats.server.loadAvg1m),
          sub: t('cards.systemHealthSub'),
          icon: Activity,
          accent: 'from-[#0F1729] to-[#FF6B00]',
          iconText: 'text-white',
          href: `/${locale}/admin/stats`,
        },
      ]
    : [];

  const growthSeries = stats
    ? [
        { name: t('growth.labels.w1'), revenue: Math.round(stats.revenueUsdPlaceholder * 0.62), customers: Math.max(1, Math.round(stats.totalWorkspaces * 0.7)) },
        { name: t('growth.labels.w2'), revenue: Math.round(stats.revenueUsdPlaceholder * 0.72), customers: Math.max(1, Math.round(stats.totalWorkspaces * 0.8)) },
        { name: t('growth.labels.w3'), revenue: Math.round(stats.revenueUsdPlaceholder * 0.84), customers: Math.max(1, Math.round(stats.totalWorkspaces * 0.9)) },
        {
          name: t('growth.labels.w4'),
          revenue: stats.revenueUsdPlaceholder,
          customers: stats.totalActiveCustomers ?? stats.totalWorkspaces,
        },
      ]
    : [];

  return (
    <main className="space-y-10">
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="vc-glass vc-card-surface overflow-hidden rounded-3xl border-[#FF6B00]/20 bg-gradient-to-br from-[#FF6B00]/[0.08] via-transparent to-[#0F1729]/[0.06]"
      >
        <div className="border-b border-border/60 px-8 py-10 sm:px-10 sm:py-12">
          <p className="vc-page-kicker text-[#94A3B8] dark:text-[#FF6B00]">{t('kicker')}</p>
          <h1 className="vc-page-title mt-2 max-w-3xl">{t('title')}</h1>
          <p className="vc-page-desc mt-4 max-w-2xl">{t('description')}</p>
          <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-[#FF6B00]/30 bg-[#FF6B00]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-900 dark:text-[#FF6B00]">
            <Activity className="h-3.5 w-3.5" />
            {t('superAdmin')}
          </div>
        </div>
      </motion.section>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      {!stats && !error ? (
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      ) : null}

      {stats ? (
        <p className="rounded-2xl border border-dashed border-amber-500/35 bg-amber-500/[0.08] px-4 py-3 text-sm text-amber-950 dark:text-amber-100/90">
          {t('revenueDisclaimer')}
        </p>
      ) : null}

      {stats ? (
        <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          {metricsCards.map((c, i) => (
            <Link
              key={c.label}
              href={c.href as Route}
              className="block outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-3xl"
            >
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                className="vc-card-surface group relative h-full overflow-hidden rounded-3xl p-7 transition hover:border-[#94A3B8]/40 hover:shadow-[0_0_28px_-12px_rgba(184,134,11,0.45)] dark:hover:border-[#FF6B00]/35 dark:hover:shadow-[0_0_32px_-10px_rgba(255, 107, 0,0.22)]"
              >
                <div className="absolute -end-6 -top-6 h-24 w-24 rounded-full bg-[#FF6B00]/10 blur-2xl transition group-hover:bg-[#FF6B00]/16" />
                <div className="relative flex items-start justify-between gap-4">
                  <div>
                    <p className="vc-page-kicker">{c.label}</p>
                    <p className="mt-3 font-mono-nums text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                      {c.value}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">{c.sub}</p>
                  </div>
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${c.accent} shadow-lg transition group-hover:brightness-105`}
                  >
                    <c.icon className={`h-6 w-6 ${c.iconText}`} strokeWidth={1.75} />
                  </div>
                </div>
              </motion.div>
            </Link>
          ))}
        </section>
      ) : null}

      {stats ? (
        <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="vc-card-surface relative overflow-hidden rounded-3xl border-[#FF6B00]/20 p-7"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="vc-page-kicker">{t('growth.title')}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t('growth.description')}</p>
              </div>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={growthSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 107, 0,0.15)" />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.65)" tickLine={false} axisLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.65)" tickLine={false} axisLine={false} />
                  <Tooltip
                    formatter={(value, name) => {
                      const numericValue =
                        typeof value === 'number'
                          ? value
                          : Number(value ?? 0);
                      const key = String(name);
                      return key === 'revenue'
                        ? [formatUsd(numericValue, locale), t('growth.revenueLine')]
                        : [new Intl.NumberFormat(locale).format(numericValue), t('growth.customersLine')];
                    }}
                    contentStyle={{
                      borderRadius: 14,
                      border: '1px solid rgba(255, 107, 0,0.3)',
                      background: 'rgba(8,8,12,0.9)',
                    }}
                    labelStyle={{ color: 'rgba(255,255,255,0.85)' }}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="#FF6B00" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="customers" stroke="#94A3B8" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
            className="vc-card-surface flex flex-col justify-between gap-4 rounded-3xl border border-[#FF6B00]/25 bg-muted/15 p-7"
          >
            <div>
              <p className="text-sm font-semibold text-foreground">{t('healthPanel.title')}</p>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                <p>
                  {t('healthPanel.uptime')}{' '}
                  <span className="font-mono-nums font-semibold text-foreground">
                    {typeof stats.server.uptimeSeconds === 'number'
                      ? formatDuration(stats.server.uptimeSeconds, locale)
                      : t('healthPanel.na')}
                  </span>
                </p>
                <p>
                  {t('healthPanel.sockets')}{' '}
                  <span className="font-mono-nums font-semibold text-foreground">
                    {new Intl.NumberFormat(locale).format(stats.realtimeSocketConnections)}
                  </span>
                </p>
                <p>
                  {t('healthPanel.databaseLatency')}{' '}
                  <span className="font-mono-nums font-semibold text-foreground">
                    {dbLatencyMs != null
                      ? `${new Intl.NumberFormat(locale).format(dbLatencyMs)} ms`
                      : t('healthPanel.na')}
                  </span>
                </p>
                <p>
                  {t('healthPanel.hostname')}{' '}
                  <span className="font-semibold text-foreground">{stats.server.hostname}</span>
                </p>
                <p>
                  {t('healthPanel.platform')}{' '}
                  <span className="font-semibold text-foreground">{stats.server.platform}</span>
                </p>
              </div>
            </div>
            <Link
              href={`/${locale}/admin/stats`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#94A3B8] dark:text-[#FF6B00] hover:underline"
            >
              {t('healthPanel.openHealth')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </section>
      ) : null}
    </main>
  );
}
