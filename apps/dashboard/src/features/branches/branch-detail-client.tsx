'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Clapperboard, Loader2, Monitor, Plus, Power, Radio } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch, readApiErrorMessage } from '@/features/auth/session';
import { useWorkspace } from '@/features/workspace/workspace-context';
import { CreateScreenDialog } from '@/features/branches/create-screen-dialog';
import { BranchWorkspaceToolbar } from '@/features/branches/branch-workspace-toolbar';
import { useApiScreens } from '@/features/screens/useApiScreens';
import { ICON_STROKE } from '@/lib/icon-stroke';
import { cn } from '@/lib/utils';

export type BranchPlaylistRow = {
  id: string;
  workspaceId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  _count: { items: number; screensInGroup: number };
};

type Props = {
  locale: string;
};

export function BranchDetailClient({ locale }: Props) {
  const t = useTranslations('branchDetail');
  const params = useParams();
  const workspaceIdParam = typeof params.workspaceId === 'string' ? params.workspaceId : '';
  const { workspaces, setWorkspaceId, bumpWorkspaceDataEpoch } = useWorkspace();
  const branch = useMemo(
    () => workspaces.find((w) => w.id === workspaceIdParam),
    [workspaces, workspaceIdParam],
  );

  const { screens, isLoading: screensLoading, reload: reloadScreens } = useApiScreens(
    workspaceIdParam || null,
  );

  const [playlists, setPlaylists] = useState<BranchPlaylistRow[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [screenDialogOpen, setScreenDialogOpen] = useState(false);

  useEffect(() => {
    if (workspaceIdParam) {
      setWorkspaceId(workspaceIdParam);
      bumpWorkspaceDataEpoch();
    }
  }, [workspaceIdParam, setWorkspaceId, bumpWorkspaceDataEpoch]);

  const loadPlaylists = useCallback(async () => {
    if (!workspaceIdParam) {
      setPlaylists([]);
      setPlaylistsLoading(false);
      return;
    }
    setPlaylistsLoading(true);
    const res = await apiFetch(`/playlists?workspaceId=${encodeURIComponent(workspaceIdParam)}`);
    if (res.ok) {
      const data = (await res.json()) as BranchPlaylistRow[];
      setPlaylists(Array.isArray(data) ? data : []);
    } else {
      setPlaylists([]);
      if (res.status !== 401) {
        toast.error(await readApiErrorMessage(res));
      }
    }
    setPlaylistsLoading(false);
  }, [workspaceIdParam]);

  useEffect(() => {
    void loadPlaylists();
  }, [loadPlaylists]);

  const onlineByPlaylistId = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of screens) {
      if (!s.playlistGroupId || s.status !== 'ONLINE') continue;
      const id = s.playlistGroupId;
      m.set(id, (m.get(id) ?? 0) + 1);
    }
    return m;
  }, [screens]);

  const stats = useMemo(() => {
    let online = 0;
    let offline = 0;
    let maintenance = 0;
    for (const s of screens) {
      if (s.status === 'ONLINE') online += 1;
      else if (s.status === 'MAINTENANCE') maintenance += 1;
      else offline += 1;
    }
    const inactive = offline + maintenance;
    return {
      total: screens.length,
      online,
      inactive,
      offline,
      maintenance,
    };
  }, [screens]);

  const onCreatePlaylist = async () => {
    const name = newName.trim();
    if (!name || !workspaceIdParam) return;
    setCreating(true);
    try {
      const res = await apiFetch('/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: workspaceIdParam, name }),
      });
      if (!res.ok) {
        toast.error(await readApiErrorMessage(res));
        return;
      }
      toast.success(t('playlistCreated'));
      setNewName('');
      setCreateOpen(false);
      await loadPlaylists();
      bumpWorkspaceDataEpoch();
    } finally {
      setCreating(false);
    }
  };

  if (!branch) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm font-medium text-muted-foreground">{t('notFound')}</p>
        <Button type="button" variant="outline" className="rounded-xl" asChild>
          <Link href={`/${locale}/overview` as Route}>{t('backOverview')}</Link>
        </Button>
      </div>
    );
  }

  const loading = screensLoading || playlistsLoading;

  return (
    <main className="space-y-10 pb-12">
      <header className="space-y-4">
        <BranchWorkspaceToolbar
          locale={locale}
          branchName={branch.name}
          onNewScreen={() => setScreenDialogOpen(true)}
        />
        <p className="vc-page-desc max-w-3xl text-balance text-[15px] leading-relaxed dark:text-white/65">
          {t('description')}
        </p>
      </header>

      <CreateScreenDialog
        open={screenDialogOpen}
        onOpenChange={setScreenDialogOpen}
        workspaceId={workspaceIdParam}
        onCreated={() => {
          void reloadScreens();
          void loadPlaylists();
        }}
      />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight text-foreground dark:text-white">
          {t('statsTitle')}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              label: t('statTotal'),
              value: loading ? '…' : String(stats.total),
              icon: Monitor,
              accent: 'from-[#0F1729]/80 to-[#1B254B]/60',
            },
            {
              label: t('statOnline'),
              value: loading ? '…' : String(stats.online),
              icon: Radio,
              accent: 'from-emerald-950/50 to-emerald-900/30',
            },
            {
              label: t('statInactive'),
              value: loading ? '…' : String(stats.inactive),
              icon: Power,
              accent: 'from-rose-950/40 to-[#1B254B]/50',
              sub: loading
                ? undefined
                : t('inactiveDetail', {
                    offline: stats.offline,
                    maintenance: stats.maintenance,
                  }),
            },
          ].map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 * i, duration: 0.35 }}
              className={cn(
                'vc-card-surface relative overflow-hidden rounded-2xl border border-[#FF6B00]/12 p-5 dark:border-white/10',
              )}
            >
              <div
                className={cn(
                  'pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90',
                  item.accent,
                )}
              />
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70">
                    {item.label}
                  </p>
                  <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-white">
                    {item.value}
                  </p>
                  {'sub' in item && item.sub ? (
                    <p className="mt-1 text-[11px] text-white/55">{item.sub}</p>
                  ) : null}
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
                  <item.icon className="h-5 w-5 text-[#FFB37A]" strokeWidth={ICON_STROKE} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground dark:text-white">
              {t('playlistsTitle')}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('playlistsSub')}</p>
          </div>
          <Button
            type="button"
            className="shrink-0 rounded-xl bg-[#FF6B00] font-semibold text-amber-950 hover:bg-[#FF6B00]/90"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="me-2 h-4 w-4" strokeWidth={ICON_STROKE} />
            {t('addPlaylist')}
          </Button>
        </div>

        {playlistsLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-[#FF6B00]" />
          </div>
        ) : playlists.length === 0 ? (
          <div className="vc-card-surface rounded-2xl border border-dashed border-[#FF6B00]/25 p-10 text-center">
            <Clapperboard className="mx-auto h-10 w-10 text-[#FF6B00]/70" strokeWidth={ICON_STROKE} />
            <p className="mt-3 text-sm font-medium text-foreground dark:text-white">{t('noPlaylists')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t('noPlaylistsHint')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {playlists.map((pl, i) => {
              const totalScreens = pl._count.screensInGroup;
              const online = onlineByPlaylistId.get(pl.id) ?? 0;
              return (
                <motion.div
                  key={pl.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.03 * i, duration: 0.3 }}
                >
                  <Link
                    href={`/${locale}/branches/${workspaceIdParam}/playlists/${pl.id}` as Route}
                    className={cn(
                      'flex flex-col rounded-2xl border border-border/60 bg-card/50 p-5 transition-all',
                      'hover:border-[#FF6B00]/40 hover:bg-[#FF6B00]/[0.06] hover:shadow-[0_0_28px_-12px_rgba(255,107,0,0.35)]',
                      'dark:border-white/10 dark:bg-[#0F1729]/40',
                      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF6B00]',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground dark:text-white">{pl.name}</p>
                        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                          {t('playlistScreenStats', { total: totalScreens, online })}
                        </p>
                        <p className="mt-1 text-[10px] text-muted-foreground/90">
                          {t('playlistItemsCount', { count: pl._count.items })}
                        </p>
                      </div>
                      <Clapperboard className="h-5 w-5 shrink-0 text-[#FF6B00]" strokeWidth={ICON_STROKE} />
                    </div>
                    <span className="mt-4 inline-flex items-center text-xs font-semibold text-[#FF6B00]">
                      {t('openPlaylist')} →
                    </span>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('playlistDialogTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="pl-name">{t('playlistNameLabel')}</Label>
            <Input
              id="pl-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t('playlistNamePlaceholder')}
              className="rounded-xl"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void onCreatePlaylist();
              }}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setCreateOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              type="button"
              className="rounded-xl bg-[#FF6B00] font-semibold text-amber-950"
              disabled={creating || !newName.trim()}
              onClick={() => void onCreatePlaylist()}
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : t('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
