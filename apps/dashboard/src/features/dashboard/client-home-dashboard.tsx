'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Route } from 'next';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { HardDrive, Image as ImageIcon, Monitor } from 'lucide-react';
import { apiFetch } from '@/features/auth/session';
import type { MediaItem } from '@/features/media/media-library-client';
import { useWorkspace, type WorkspaceSummary } from '@/features/workspace/workspace-context';
import { ICON_STROKE } from '@/lib/icon-stroke';
import { cn } from '@/lib/utils';

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

async function fetchWorkspaceStats(workspaceId: string): Promise<{
  screens: number;
  mediaCount: number;
  storageBytes: number;
}> {
  try {
    const [sRes, mRes] = await Promise.all([
      apiFetch(`/screens?workspaceId=${encodeURIComponent(workspaceId)}&page=1&limit=500`),
      apiFetch(`/media?workspaceId=${encodeURIComponent(workspaceId)}`),
    ]);
    let screens = 0;
    if (sRes.ok) {
      const sJson = (await sRes.json()) as { total?: number };
      screens = typeof sJson.total === 'number' ? sJson.total : 0;
    }
    let mediaCount = 0;
    let storageBytes = 0;
    if (mRes.ok) {
      const list = (await mRes.json()) as MediaItem[];
      const arr = Array.isArray(list) ? list : [];
      mediaCount = arr.length;
      storageBytes = arr.reduce((acc, m) => acc + (m.sizeBytes ?? 0), 0);
    }
    return { screens, mediaCount, storageBytes };
  } catch {
    return { screens: 0, mediaCount: 0, storageBytes: 0 };
  }
}

export function ClientHomeDashboard() {
  const t = useTranslations('clientHome');
  const locale = useLocale();
  const { workspaces, workspaceId, setWorkspaceId, bumpWorkspaceDataEpoch } = useWorkspace();
  const [stats, setStats] = useState<
    Record<string, { screens: number; mediaCount: number; storageBytes: number }>
  >({});
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    if (workspaces.length === 0) {
      setStats({});
      setLoading(false);
      return;
    }
    setLoading(true);
    const entries = await Promise.all(
      workspaces.map(async (w) => {
        const s = await fetchWorkspaceStats(w.id);
        return [w.id, s] as const;
      }),
    );
    setStats(Object.fromEntries(entries));
    setLoading(false);
  }, [workspaces]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const totals = useMemo(() => {
    let screens = 0;
    let mediaCount = 0;
    let storageBytes = 0;
    for (const w of workspaces) {
      const row = stats[w.id];
      if (!row) continue;
      screens += row.screens;
      mediaCount += row.mediaCount;
      storageBytes += row.storageBytes;
    }
    return { screens, mediaCount, storageBytes };
  }, [stats, workspaces]);

  if (workspaces.length === 0) {
    return null;
  }

  return (
    <div className="space-y-10">
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
              label: t('totalScreens'),
              value: loading ? '…' : String(totals.screens),
              icon: Monitor,
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
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground dark:text-white">
            {t('branchesTitle')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('branchesSub')}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {workspaces.map((w: WorkspaceSummary, i: number) => {
            const row = stats[w.id];
            const active = w.id === workspaceId;
            const branchHref = `/${locale}/branches/${w.id}`;
            return (
              <motion.div
                key={w.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 * i, duration: 0.35 }}
                className={cn(
                  'relative flex min-h-[160px] flex-col rounded-2xl border p-5 transition-colors',
                  active
                    ? 'border-[#FF6B00]/45 bg-[#FF6B00]/[0.07] shadow-[0_0_32px_-12px_rgba(255,107,0,0.35)]'
                    : 'border-border/60 bg-card/40 dark:border-white/10',
                )}
              >
                <Link
                  href={branchHref as Route}
                  className="absolute inset-0 z-0 rounded-2xl"
                  aria-label={t('openBranchAria', { name: w.name })}
                  onClick={() => {
                    setWorkspaceId(w.id);
                    bumpWorkspaceDataEpoch();
                  }}
                />
                <div className="pointer-events-none relative z-[1] flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground dark:text-white">{w.name}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{w.slug}</p>
                  </div>
                  {active ? (
                    <span className="shrink-0 rounded-md bg-[#FF6B00]/20 px-2 py-0.5 text-[10px] font-bold uppercase text-[#FF6B00]">
                      {t('active')}
                    </span>
                  ) : null}
                </div>
                <div className="pointer-events-none relative z-[1] mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-4 text-center">
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground">{t('card.screens')}</p>
                    <p className="font-mono text-sm font-semibold tabular-nums">
                      {loading || !row ? '…' : row.screens}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground">{t('card.media')}</p>
                    <p className="font-mono text-sm font-semibold tabular-nums">
                      {loading || !row ? '…' : row.mediaCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground">{t('card.storage')}</p>
                    <p className="font-mono text-xs font-semibold tabular-nums">
                      {loading || !row ? '…' : formatBytes(row.storageBytes)}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
