'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Loader2, Monitor, PenLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/features/auth/session';
import { useWorkspace } from '@/features/workspace/workspace-context';
import { ScreenQuickEditPanel } from '@/features/screens/screen-quick-edit-panel';
import { useApiScreens, type ScreenRow } from '@/features/screens/useApiScreens';
import { ICON_STROKE } from '@/lib/icon-stroke';
import { cn } from '@/lib/utils';

type Props = {
  locale: string;
};

function StatusBadge({ status }: { status: ScreenRow['status'] }) {
  const t = useTranslations('screensClient');
  const live = status === 'ONLINE';
  const maintenance = status === 'MAINTENANCE';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]',
        live &&
          'border border-emerald-400/40 bg-emerald-500/15 text-emerald-100 shadow-[0_0_18px_rgba(16,185,129,0.45)]',
        !live &&
          maintenance &&
          'border border-amber-400/35 bg-amber-500/12 text-amber-100 shadow-[0_0_14px_rgba(245,158,11,0.35)]',
        !live &&
          !maintenance &&
          'border border-red-400/35 bg-red-500/12 text-red-100 shadow-[0_0_16px_rgba(239,68,68,0.35)]',
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          live && 'animate-pulse bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]',
          maintenance && 'bg-amber-400',
          !live && !maintenance && 'bg-red-400',
        )}
      />
      {live ? t('status.live') : maintenance ? t('status.maintenance') : t('status.offline')}
    </span>
  );
}

export function PlaylistScreensClient({ locale }: Props) {
  const t = useTranslations('playlistScreens');
  const params = useParams();
  const workspaceIdParam = typeof params.workspaceId === 'string' ? params.workspaceId : '';
  const playlistIdParam = typeof params.playlistId === 'string' ? params.playlistId : '';
  const { workspaces, setWorkspaceId, bumpWorkspaceDataEpoch } = useWorkspace();
  const branch = useMemo(
    () => workspaces.find((w) => w.id === workspaceIdParam),
    [workspaces, workspaceIdParam],
  );

  const { screens, isLoading, reload } = useApiScreens(workspaceIdParam || null, {
    playlistGroupId: playlistIdParam,
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editScreen, setEditScreen] = useState<ScreenRow | null>(null);
  const [playlistName, setPlaylistName] = useState<string | null>(null);

  useEffect(() => {
    if (workspaceIdParam) {
      setWorkspaceId(workspaceIdParam);
      bumpWorkspaceDataEpoch();
    }
  }, [workspaceIdParam, setWorkspaceId, bumpWorkspaceDataEpoch]);

  useEffect(() => {
    if (!workspaceIdParam || !playlistIdParam) {
      setPlaylistName(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await apiFetch(
        `/playlists/${encodeURIComponent(playlistIdParam)}?workspaceId=${encodeURIComponent(workspaceIdParam)}`,
      );
      if (!res.ok || cancelled) return;
      const row = (await res.json()) as { name?: string };
      if (!cancelled) setPlaylistName(typeof row.name === 'string' ? row.name : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceIdParam, playlistIdParam]);

  const openEdit = useCallback((s: ScreenRow) => {
    setEditScreen(s);
    setEditOpen(true);
  }, []);

  if (!branch) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm font-medium text-muted-foreground">{t('branchNotFound')}</p>
        <Button type="button" variant="outline" className="rounded-xl" asChild>
          <Link href={`/${locale}/overview` as Route}>{t('backOverview')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <main className="space-y-8 pb-12">
      <header className="space-y-1">
        <p className="vc-page-kicker">{t('kicker')}</p>
        <h1 className="vc-page-title text-balance dark:text-white">
          {playlistName ? playlistName : t('title')}
        </h1>
        <p className="vc-page-desc max-w-2xl text-balance dark:text-white/65">
          {t('description', { branch: branch.name })}
        </p>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-[#FF6B00]" />
        </div>
      ) : screens.length === 0 ? (
        <div className="vc-card-surface rounded-2xl border border-dashed border-[#FF6B00]/25 p-10 text-center">
          <Monitor className="mx-auto h-10 w-10 text-[#FF6B00]/70" strokeWidth={ICON_STROKE} />
          <p className="mt-3 text-sm font-medium text-foreground dark:text-white">{t('empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {screens.map((screen, i) => (
            <motion.article
              key={screen.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.03 * i, duration: 0.3 }}
              className="vc-card-surface flex flex-col rounded-2xl border border-border/60 p-5 dark:border-white/10"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-foreground dark:text-white">{screen.name}</h3>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">{screen.serialNumber}</p>
                </div>
                <StatusBadge status={screen.status} />
              </div>
              {screen.location ? (
                <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{screen.location}</p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                <Button
                  type="button"
                  size="sm"
                  className="rounded-xl bg-[#FF6B00] font-semibold text-amber-950 hover:bg-[#FF6B00]/90"
                  onClick={() => openEdit(screen)}
                >
                  <PenLine className="me-2 h-3.5 w-3.5" strokeWidth={ICON_STROKE} />
                  {t('edit')}
                </Button>
              </div>
            </motion.article>
          ))}
        </div>
      )}

      <ScreenQuickEditPanel
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditScreen(null);
        }}
        screen={editScreen}
        workspaceId={workspaceIdParam}
        locale={locale}
        onSaved={reload}
        onEditScreen={() => {
          /* full editor not routed separately */
        }}
      />
    </main>
  );
}
