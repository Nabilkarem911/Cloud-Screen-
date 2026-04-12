'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import {
  Clock3,
  Database,
  HardDrive,
  Image as ImageIcon,
  ListMusic,
  Loader2,
  Monitor,
  MoreVertical,
  Network,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch, readApiErrorMessage } from '@/features/auth/session';
import { useWorkspace, type WorkspaceSummary } from '@/features/workspace/workspace-context';
import { ICON_STROKE } from '@/lib/icon-stroke';
import { cn } from '@/lib/utils';

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

type InsightsBranch = {
  workspaceId: string;
  name: string;
  slug: string;
  isPaused?: boolean;
  role: string;
  createdAt: string;
  screens: number;
  playlists: number;
  mediaCount: number;
  storageBytes: number;
  screenStatus: { online: number; offline: number; maintenance: number };
  subscription: {
    plan: string;
    status: string;
    seats: number;
    screenLimit: number;
    storageLimitBytes: number | null;
    currentPeriodEnd: string | null;
  } | null;
};

type InsightsPayload = {
  account: { subscriptionStatus: string; subscriptionEndDate: string | null };
  plan: {
    plan: string;
    status: string;
    seats: number;
    screenLimit: number;
    currentPeriodEnd: string | null;
  } | null;
  totals: {
    branches: number;
    screens: number;
    playlists: number;
    mediaCount: number;
    storageBytes: number;
    screenStatus: { online: number; offline: number; maintenance: number };
  };
  branches: InsightsBranch[];
};

type HealthKey = 'paused' | 'healthy' | 'mixed' | 'down' | 'empty';

function branchHealth(row: InsightsBranch): HealthKey {
  if (row.isPaused === true) return 'paused';
  if (row.screens === 0) return 'empty';
  const { online, offline, maintenance } = row.screenStatus;
  if (online === 0) return 'down';
  if (offline > 0 || maintenance > 0) return 'mixed';
  return 'healthy';
}

function canManageBranch(role: string): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

function canDeleteBranch(role: string, isSuperAdmin: boolean): boolean {
  return canManageBranch(role) || isSuperAdmin;
}

function formatBytesLocale(n: number, locale: string): string {
  if (n < 1024) return new Intl.NumberFormat(locale).format(n) + ' B';
  if (n < 1024 * 1024)
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(n / 1024)} KB`;
  if (n < 1024 * 1024 * 1024)
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(n / (1024 * 1024))} MB`;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(n / (1024 * 1024 * 1024))} GB`;
}

export function ClientHomeDashboard() {
  const t = useTranslations('clientHome');
  const tWs = useTranslations('clientHome.workspaceSummary');
  const tMetrics = useTranslations('overviewMetrics');
  const locale = useLocale();
  const router = useRouter();
  const {
    workspaces,
    workspaceId,
    setWorkspaceId,
    bumpWorkspaceDataEpoch,
    refreshWorkspaces,
    workspaceDataEpoch,
    isSuperAdmin,
  } = useWorkspace();
  const [insights, setInsights] = useState<InsightsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState<InsightsBranch | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameBusy, setRenameBusy] = useState(false);
  const [pauseBusyId, setPauseBusyId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const loadAll = useCallback(async () => {
    if (workspaces.length === 0) {
      setInsights(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await apiFetch('/account/insights');
    if (!res.ok) {
      setInsights(null);
      setLoading(false);
      return;
    }
    const payload = (await res.json()) as InsightsPayload;
    setInsights(payload);
    setLoading(false);
  }, [workspaces.length, workspaceDataEpoch]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!insights) return;
    setSelectedBranch((prev) => {
      if (!prev) return prev;
      const row = insights.branches.find((b) => b.workspaceId === prev.workspaceId);
      return row ?? null;
    });
  }, [insights]);

  const totals = insights?.totals ?? {
    branches: 0,
    screens: 0,
    playlists: 0,
    mediaCount: 0,
    storageBytes: 0,
    screenStatus: { online: 0, offline: 0, maintenance: 0 },
  };

  const daysRemaining = useMemo(() => {
    if (!insights?.account.subscriptionEndDate) return null;
    const diffMs =
      new Date(insights.account.subscriptionEndDate).getTime() - Date.now();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }, [insights?.account.subscriptionEndDate]);

  const submitRename = useCallback(async () => {
    if (!selectedBranch) return;
    const name = renameValue.trim();
    if (name.length < 2) {
      toast.error(t('renameTooShort'));
      return;
    }
    setRenameBusy(true);
    try {
      const res = await apiFetch(
        `/workspaces/${encodeURIComponent(selectedBranch.workspaceId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        },
      );
      if (!res.ok) {
        toast.error(await readApiErrorMessage(res));
        return;
      }
      toast.success(t('branchUpdated'));
      setRenameOpen(false);
      await refreshWorkspaces(workspaceId);
      bumpWorkspaceDataEpoch();
      await loadAll();
    } finally {
      setRenameBusy(false);
    }
  }, [
    selectedBranch,
    renameValue,
    refreshWorkspaces,
    workspaceId,
    bumpWorkspaceDataEpoch,
    loadAll,
    t,
  ]);

  const togglePause = useCallback(
    async (target: InsightsBranch) => {
      const next = target.isPaused !== true;
      setPauseBusyId(target.workspaceId);
      try {
        const res = await apiFetch(
          `/workspaces/${encodeURIComponent(target.workspaceId)}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isPaused: next }),
          },
        );
        if (!res.ok) {
          toast.error(await readApiErrorMessage(res));
          return;
        }
        toast.success(next ? t('branchPaused') : t('branchResumed'));
        setSelectedBranch((prev) =>
          prev?.workspaceId === target.workspaceId ? { ...prev, isPaused: next } : prev,
        );
        await refreshWorkspaces(workspaceId);
        bumpWorkspaceDataEpoch();
        await loadAll();
      } finally {
        setPauseBusyId(null);
      }
    },
    [refreshWorkspaces, workspaceId, bumpWorkspaceDataEpoch, loadAll, t],
  );

  const confirmDeleteBranch = useCallback(async () => {
    if (!selectedBranch) return;
    const deletedId = selectedBranch.workspaceId;
    setDeleteBusy(true);
    try {
      const res = await apiFetch(`/workspaces/${encodeURIComponent(deletedId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        toast.error(await readApiErrorMessage(res));
        return;
      }
      toast.success(t('branchDeleted'));
      setDeleteOpen(false);
      setSelectedBranch(null);
      await refreshWorkspaces();
      bumpWorkspaceDataEpoch();
      if (workspaceId === deletedId) {
        router.push(`/${locale}/overview` as Route);
      }
      await loadAll();
    } finally {
      setDeleteBusy(false);
    }
  }, [
    selectedBranch,
    refreshWorkspaces,
    bumpWorkspaceDataEpoch,
    workspaceId,
    router,
    locale,
    loadAll,
    t,
  ]);

  if (workspaces.length === 0) {
    return null;
  }

  const currentWsRow =
    workspaceId && insights
      ? insights.branches.find((b) => b.workspaceId === workspaceId)
      : null;
  const currentWsName =
    workspaces.find((w: WorkspaceSummary) => w.id === workspaceId)?.name ?? '';
  const storageQuota = currentWsRow?.subscription?.storageLimitBytes ?? null;
  const storagePct =
    storageQuota != null && storageQuota > 0
      ? Math.min(100, Math.round((100 * currentWsRow!.storageBytes) / storageQuota))
      : null;

  const cardChrome =
    'group relative flex min-h-[160px] cursor-pointer flex-col rounded-2xl border border-[#FF6B00]/45 bg-[#FF6B00]/[0.07] p-5 pe-12 shadow-[0_0_32px_-12px_rgba(255,107,0,0.35)] transition-all duration-300 ease-out will-change-transform hover:-translate-y-1 hover:border-[#FF6B00]/55 hover:shadow-[0_0_40px_-8px_rgba(255,107,0,0.45)] dark:bg-[#FF6B00]/[0.05]';

  const healthBadgeClass = (h: HealthKey) =>
    h === 'healthy'
      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
      : h === 'down'
        ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
        : h === 'paused'
          ? 'bg-amber-500/15 text-amber-800 dark:text-amber-200'
          : h === 'empty'
            ? 'bg-slate-500/15 text-slate-600 dark:text-slate-300'
            : 'bg-amber-500/15 text-amber-800 dark:text-amber-200';

  const renderBranchDetailBody = (row: InsightsBranch) => {
    const detailMetrics = [
      {
        label: tMetrics('screens'),
        value: loading ? '…' : String(row.screens),
        sub: tMetrics('screensSub'),
        icon: Monitor,
      },
      {
        label: tMetrics('media'),
        value: loading ? '…' : String(row.mediaCount),
        sub: tMetrics('mediaSub'),
        icon: Database,
      },
      {
        label: tMetrics('storage'),
        value: loading ? '…' : formatBytes(row.storageBytes),
        sub: tMetrics('storageSub'),
        icon: HardDrive,
      },
    ];
    return (
      <div className="space-y-6">
        <div
          className={cn(
            'inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase',
            healthBadgeClass(branchHealth(row)),
          )}
        >
          {t(`health.${branchHealth(row)}`)}
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {detailMetrics.map((metric, i) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i, duration: 0.35 }}
              className="vc-card-surface vc-stat-card-glow rounded-3xl border border-[#FF6B00]/10 p-6 dark:border-white/10"
            >
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className="vc-page-kicker">{metric.label}</p>
                  <p className="mt-3 font-mono-nums text-2xl font-bold tracking-tight text-foreground dark:text-white sm:text-3xl">
                    {metric.value}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground dark:text-white/60">{metric.sub}</p>
                </div>
                <div className="vc-icon-glass-circle relative flex h-12 w-12 shrink-0 items-center justify-center ring-1 ring-white/10 sm:h-14 sm:w-14">
                  <metric.icon
                    className="h-5 w-5 text-[#FF6B00] sm:h-[26px] sm:w-[26px]"
                    strokeWidth={ICON_STROKE}
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 text-center dark:border-white/10">
          <div>
            <p className="text-[10px] font-medium text-muted-foreground">{t('card.playlists')}</p>
            <p className="font-mono text-sm font-semibold tabular-nums text-foreground dark:text-white">
              {loading ? '…' : row.playlists}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-medium text-muted-foreground">{t('card.online')}</p>
            <p className="font-mono text-sm font-semibold tabular-nums text-foreground dark:text-white">
              {loading ? '…' : row.screenStatus.online}
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" className="w-full rounded-xl" asChild>
          <Link
            href={`/${locale}/branches/${row.workspaceId}` as Route}
            onClick={() => {
              setWorkspaceId(row.workspaceId);
              bumpWorkspaceDataEpoch();
            }}
          >
            {t('openBranchDashboard')}
          </Link>
        </Button>
        <p className="text-center text-[11px] text-muted-foreground">{t('branchCardMenuHint')}</p>
      </div>
    );
  };

  return (
    <div className="space-y-10">
      {workspaceId && currentWsRow ? (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="vc-card-surface rounded-3xl border border-[#FF6B00]/15 p-6 sm:p-8 dark:border-white/10"
        >
          <p className="vc-page-kicker">{tWs('kicker')}</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground dark:text-white">
            {tWs('title', { name: currentWsName || currentWsRow.name })}
          </h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border border-border/60 bg-muted/15 p-5 dark:border-white/10">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {tWs('screensLabel')}
              </p>
              <p className="mt-2 font-mono-nums text-3xl font-bold tabular-nums text-foreground dark:text-white">
                {loading ? '…' : tWs('screensValue', { count: currentWsRow.screens })}
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/15 p-5 dark:border-white/10">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {tWs('storageLabel')}
              </p>
              <p className="mt-2 text-sm text-foreground dark:text-white">
                {loading
                  ? '…'
                  : storageQuota != null && storageQuota > 0
                    ? tWs('storageUsedOf', {
                        used: formatBytesLocale(currentWsRow.storageBytes, locale),
                        quota: formatBytesLocale(storageQuota, locale),
                      })
                    : tWs('storageUsedNoQuota', {
                        used: formatBytesLocale(currentWsRow.storageBytes, locale),
                      })}
              </p>
              {storagePct != null ? (
                <div
                  className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={storagePct}
                  aria-label={tWs('storageBarAria')}
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#FF6B00] to-amber-400 transition-[width] duration-500"
                    style={{ width: `${storagePct}%` }}
                  />
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">{tWs('storageNoQuotaHint')}</p>
              )}
            </div>
          </div>
        </motion.section>
      ) : null}

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground dark:text-white">
            {t('totalsTitle')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('totalsSub')}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              label: t('totalBranches'),
              value: loading ? '…' : String(totals.branches),
              icon: Network,
            },
            {
              label: t('totalScreens'),
              value: loading ? '…' : String(totals.screens),
              icon: Monitor,
            },
            {
              label: t('totalPlaylists'),
              value: loading ? '…' : String(totals.playlists),
              icon: ListMusic,
            },
            {
              label: t('totalMedia'),
              value: loading ? '…' : String(totals.mediaCount),
              icon: ImageIcon,
            },
            {
              label: t('totalStorage'),
              value: loading ? '…' : formatBytes(totals.storageBytes),
              icon: HardDrive,
            },
            {
              label: t('subscriptionDaysLeft'),
              value: loading ? '…' : daysRemaining == null ? t('notSet') : String(daysRemaining),
              icon: Clock3,
            },
          ].map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i, duration: 0.35 }}
              className="vc-card-surface rounded-2xl border border-[#FF6B00]/10 p-5 dark:border-white/10"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-foreground dark:text-white">
                    {item.value}
                  </p>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FF6B00]/12 ring-1 ring-[#FF6B00]/25">
                  <item.icon className="h-5 w-5 text-[#FF6B00]" strokeWidth={ICON_STROKE} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        <div className="rounded-2xl border border-[#FF6B00]/15 bg-[#FF6B00]/[0.04] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {t('screenStatusSummary')}
          </p>
          <p className="mt-2 text-sm text-foreground dark:text-white">
            {t('screenStatusValues', {
              online: totals.screenStatus.online,
              offline: totals.screenStatus.offline,
              maintenance: totals.screenStatus.maintenance,
            })}
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground dark:text-white">
            {t('branchesTitle')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('branchesSub')}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {(insights?.branches ?? []).map((row, i: number) => {
            const w = workspaces.find((x: WorkspaceSummary) => x.id === row.workspaceId);
            if (!w) return null;
            const branchHref = `/${locale}/branches/${row.workspaceId}`;
            const h = branchHealth(row);
            const selected = selectedBranch?.workspaceId === row.workspaceId;
            const showMenu = canManageBranch(row.role);
            const pauseBusy = pauseBusyId === row.workspaceId;
            return (
              <motion.div
                key={w.id}
                role="button"
                tabIndex={0}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 * i, duration: 0.35 }}
                className={cn(
                  cardChrome,
                  'bg-gradient-to-br from-card/90 via-card/50 to-[#0F1729]/25 dark:from-[#0F1729]/80 dark:via-[#0B1220]/50 dark:to-black/20',
                  selected && 'ring-2 ring-[#FF6B00]/70 ring-offset-2 ring-offset-background dark:ring-offset-[#0B1220]',
                )}
                onClick={() => setSelectedBranch(row)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedBranch(row);
                  }
                }}
              >
                {showMenu ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute end-2 top-2 z-20 h-9 w-9 rounded-xl text-muted-foreground hover:bg-[#FF6B00]/12 hover:text-foreground"
                        aria-label={t('branchCardActionsAria')}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-4 w-4" strokeWidth={ICON_STROKE} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="min-w-[12rem]"
                      onCloseAutoFocus={(e) => e.preventDefault()}
                    >
                      <DropdownMenuItem
                        className="gap-2 font-semibold"
                        onSelect={(e) => {
                          e.preventDefault();
                          setSelectedBranch(row);
                          setRenameValue(row.name);
                          setRenameOpen(true);
                        }}
                      >
                        {t('renameBranch')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="gap-2 font-semibold"
                        disabled={pauseBusy}
                        onSelect={(e) => {
                          e.preventDefault();
                          setSelectedBranch(row);
                          void togglePause(row);
                        }}
                      >
                        {pauseBusy ? (
                          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={ICON_STROKE} />
                        ) : row.isPaused === true ? (
                          t('resumeBranch')
                        ) : (
                          t('pauseBranch')
                        )}
                      </DropdownMenuItem>
                      {canDeleteBranch(row.role, isSuperAdmin) ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="gap-2 font-semibold text-red-600 focus:text-red-600"
                            onSelect={(e) => {
                              e.preventDefault();
                              setSelectedBranch(row);
                              setDeleteOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" strokeWidth={ICON_STROKE} />
                            {t('deleteBranch')}
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
                <div className="relative z-[1] flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={branchHref as Route}
                      className="block truncate font-semibold text-foreground underline-offset-4 hover:underline dark:text-white"
                      aria-label={t('openBranchAria', { name: w.name })}
                      onClick={(e) => {
                        e.stopPropagation();
                        setWorkspaceId(row.workspaceId);
                        bumpWorkspaceDataEpoch();
                      }}
                    >
                      {w.name}
                    </Link>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase',
                      healthBadgeClass(h),
                    )}
                  >
                    {t(`health.${h}`)}
                  </span>
                </div>
                <div className="relative z-[1] mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-4 text-center">
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground">{t('card.screens')}</p>
                    <p className="font-mono text-sm font-semibold tabular-nums">
                      {loading ? '…' : row.screens}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground">{t('card.playlists')}</p>
                    <p className="font-mono text-sm font-semibold tabular-nums">
                      {loading ? '…' : row.playlists}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground">{t('card.media')}</p>
                    <p className="font-mono text-sm font-semibold tabular-nums">
                      {loading ? '…' : row.mediaCount}
                    </p>
                  </div>
                </div>
                <div className="relative z-[1] mt-2 grid grid-cols-2 gap-2 border-t border-white/10 pt-3 text-center">
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground">{t('card.storage')}</p>
                    <p className="font-mono text-xs font-semibold tabular-nums">
                      {loading ? '…' : formatBytes(row.storageBytes)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground">{t('card.online')}</p>
                    <p className="font-mono text-xs font-semibold tabular-nums">
                      {loading ? '…' : row.screenStatus.online}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="vc-card-surface rounded-2xl border border-[#FF6B00]/15 p-5 dark:border-white/10 sm:p-6">
          <h3 className="text-base font-semibold tracking-tight text-foreground dark:text-white">
            {t('branchPanelTitle')}
          </h3>
          {selectedBranch ? (
            <div className="mt-4">{renderBranchDetailBody(selectedBranch)}</div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">{t('selectBranchHint')}</p>
          )}
        </div>
      </section>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('renameDialogTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="branch-rename">{t('renameLabel')}</Label>
            <Input
              id="branch-rename"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="rounded-xl"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submitRename();
              }}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setRenameOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              type="button"
              className="rounded-xl bg-[#FF6B00] font-semibold text-amber-950"
              disabled={renameBusy || !renameValue.trim() || renameValue.trim().length < 2}
              onClick={() => void submitRename()}
            >
              {renameBusy ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={ICON_STROKE} /> : t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteBranchTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteBranchBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel className="rounded-xl" disabled={deleteBusy}>
              {t('cancel')}
            </AlertDialogCancel>
            <Button
              type="button"
              className="rounded-xl bg-red-600 font-semibold text-white hover:bg-red-600/90"
              disabled={deleteBusy}
              onClick={() => void confirmDeleteBranch()}
            >
              {deleteBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={ICON_STROKE} />
              ) : (
                t('deleteBranchConfirm')
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
