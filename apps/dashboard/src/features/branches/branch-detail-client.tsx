'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  CheckCircle2,
  Clapperboard,
  Copy,
  Image as ImageIcon,
  Loader2,
  Monitor,
  MoreVertical,
  PenLine,
  Plus,
  Power,
  Radio,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  apiFetch,
  parseScreenLimitFromApiMessage,
  readApiErrorMessage,
} from '@/features/auth/session';
import { useWorkspace } from '@/features/workspace/workspace-context';
import { type MediaItem } from '@/features/media/media-library-client';
import { CreateScreenDialog } from '@/features/branches/create-screen-dialog';
import { BranchWorkspaceToolbar, type BranchTab } from '@/features/branches/branch-workspace-toolbar';
import { ScreenQuickEditPanel } from '@/features/screens/screen-quick-edit-panel';
import { ScreenFleetStatusBadge } from '@/features/screens/screen-fleet-status';
import { type ScreenRow, useApiScreens } from '@/features/screens/useApiScreens';
import { useShellHeaderInsetSetter } from '@/components/layout/shell-header-inset-context';
import { ICON_STROKE } from '@/lib/icon-stroke';
import { cn } from '@/lib/utils';

export type BranchPlaylistRow = {
  id: string;
  workspaceId: string;
  name: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { items: number; screensInGroup: number };
};

type Props = {
  locale: string;
};

export function BranchDetailClient({ locale }: Props) {
  const t = useTranslations('branchDetail');
  const tToolbar = useTranslations('branchToolbar');
  const params = useParams();
  const workspaceIdParam = typeof params.workspaceId === 'string' ? params.workspaceId : '';
  const {
    workspaces,
    setWorkspaceId,
    bumpWorkspaceDataEpoch,
    pairingActivityEpoch,
  } = useWorkspace();
  const pairingModalBaseEpochRef = useRef(0);
  const branch = useMemo(
    () => workspaces.find((w) => w.id === workspaceIdParam),
    [workspaces, workspaceIdParam],
  );

  const { screens, setScreens, isLoading: screensLoading, reload: reloadScreens } = useApiScreens(
    workspaceIdParam || null,
  );

  const [playlists, setPlaylists] = useState<BranchPlaylistRow[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [screenDialogOpen, setScreenDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<BranchTab>('playlists');
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editScreen, setEditScreen] = useState<ScreenRow | null>(null);
  const [pairingModalOpen, setPairingModalOpen] = useState(false);
  const [playerPairCode, setPlayerPairCode] = useState('');
  const [playerPairName, setPlayerPairName] = useState('');
  const [playerPairBusy, setPlayerPairBusy] = useState(false);
  const [pairingClaimError, setPairingClaimError] = useState<string | null>(null);
  const [pairingLinkSuccess, setPairingLinkSuccess] = useState(false);
  const pairingSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [playlistToDelete, setPlaylistToDelete] = useState<BranchPlaylistRow | null>(null);
  const [playlistToMove, setPlaylistToMove] = useState<BranchPlaylistRow | null>(null);
  const [moveTargetId, setMoveTargetId] = useState('');
  const [moveBusy, setMoveBusy] = useState(false);
  const [deletePlaylistBusy, setDeletePlaylistBusy] = useState(false);
  const [playlistDeleteForce, setPlaylistDeleteForce] = useState(false);
  const [duplicatePlaylistBusyId, setDuplicatePlaylistBusyId] = useState<string | null>(null);
  const [playlistEditOpen, setPlaylistEditOpen] = useState(false);
  const [playlistToEdit, setPlaylistToEdit] = useState<BranchPlaylistRow | null>(null);
  const [editPlaylistName, setEditPlaylistName] = useState('');
  const [editPlaylistPublished, setEditPlaylistPublished] = useState(false);
  const [editPlaylistSaving, setEditPlaylistSaving] = useState(false);
  const [assignPlaybackScreenId, setAssignPlaybackScreenId] = useState<string | null>(null);

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
      setPlaylists(
        Array.isArray(data)
          ? data.map((p) => ({
              ...p,
              isPublished: p.isPublished === true,
            }))
          : [],
      );
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

  const loadMedia = useCallback(async () => {
    if (!workspaceIdParam) {
      setMediaItems([]);
      setMediaLoading(false);
      return;
    }
    setMediaLoading(true);
    const res = await apiFetch(`/media?workspaceId=${encodeURIComponent(workspaceIdParam)}`);
    if (res.ok) {
      const data = (await res.json()) as MediaItem[];
      setMediaItems(Array.isArray(data) ? data : []);
    } else {
      setMediaItems([]);
    }
    setMediaLoading(false);
  }, [workspaceIdParam]);

  useEffect(() => {
    void loadMedia();
  }, [loadMedia]);

  useEffect(() => {
    if (!pairingModalOpen || !workspaceIdParam) return;
    pairingModalBaseEpochRef.current = pairingActivityEpoch;
    void apiFetch(
      `/workspaces/${encodeURIComponent(workspaceIdParam)}/pairing-started`,
      { method: 'POST', body: '{}' },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot epoch only when modal opens; avoid re-POST on each pairing signal
  }, [pairingModalOpen, workspaceIdParam]);

  useEffect(() => {
    return () => {
      if (pairingSuccessTimerRef.current) {
        clearTimeout(pairingSuccessTimerRef.current);
        pairingSuccessTimerRef.current = null;
      }
    };
  }, []);

  const openPairingModal = useCallback(() => {
    if (pairingSuccessTimerRef.current) {
      clearTimeout(pairingSuccessTimerRef.current);
      pairingSuccessTimerRef.current = null;
    }
    setPairingClaimError(null);
    setPairingLinkSuccess(false);
    setPlayerPairCode('');
    setPlayerPairName('');
    setPairingModalOpen(true);
  }, []);

  const setHeaderInset = useShellHeaderInsetSetter();

  const branchHeaderToolbar = useMemo(
    () => (
      <BranchWorkspaceToolbar
        variant="inline"
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onNewPlaylist={() => setCreateOpen(true)}
        onNewScreen={() => setScreenDialogOpen(true)}
        onNewMedia={() => {
          window.location.assign(`/${locale}/media`);
        }}
        onOpenPairingModal={openPairingModal}
      />
    ),
    [activeTab, locale, openPairingModal],
  );

  useLayoutEffect(() => {
    if (!setHeaderInset) return;
    if (!branch) {
      setHeaderInset(null);
      return;
    }
    setHeaderInset(branchHeaderToolbar);
    return () => setHeaderInset(null);
  }, [setHeaderInset, branch, branchHeaderToolbar]);

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

  const canDeletePlaylist = Boolean(
    branch && (branch.role === 'OWNER' || branch.role === 'ADMIN'),
  );
  const canClaimPlayerPairing = canDeletePlaylist;
  const canEditPlaylist = Boolean(branch && branch.role !== 'VIEWER');

  const assignScreenPlaybackPlaylist = useCallback(
    async (screenId: string, playlistId: string | null) => {
      if (!workspaceIdParam) return;
      setAssignPlaybackScreenId(screenId);
      try {
        const res = await apiFetch(
          `/screens/${encodeURIComponent(screenId)}?workspaceId=${encodeURIComponent(workspaceIdParam)}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activePlaylistId: playlistId }),
          },
        );
        if (!res.ok) {
          toast.error(await readApiErrorMessage(res));
          return;
        }
        const name =
          playlistId === null
            ? null
            : (playlists.find((p) => p.id === playlistId)?.name ?? null);
        setScreens((prev) =>
          prev.map((s) =>
            s.id === screenId
              ? {
                  ...s,
                  activePlaylistId: playlistId,
                  activePlaylist:
                    playlistId && name ? { id: playlistId, name } : null,
                }
              : s,
          ),
        );
        toast.success(t('screenPlaylistAssignOk'));
        bumpWorkspaceDataEpoch();
      } finally {
        setAssignPlaybackScreenId(null);
      }
    },
    [workspaceIdParam, playlists, setScreens, bumpWorkspaceDataEpoch, t],
  );

  const claimPlayerPairing = useCallback(async () => {
    if (!workspaceIdParam || !canClaimPlayerPairing) return;
    const code = playerPairCode.replace(/\D/g, '').slice(0, 6);
    if (code.length !== 6) return;
    setPairingClaimError(null);
    setPlayerPairBusy(true);
    try {
      const body: { code: string; name?: string } = { code };
      const trimmedName = playerPairName.trim();
      if (trimmedName) body.name = trimmedName;
      const res = await apiFetch(
        `/workspaces/${encodeURIComponent(workspaceIdParam)}/pairing-sessions/claim`,
        { method: 'POST', body: JSON.stringify(body) },
      );
      if (!res.ok) {
        const msg = await readApiErrorMessage(res);
        if (msg.includes('LIMIT_REACHED') || parseScreenLimitFromApiMessage(msg) !== null) {
          setPairingClaimError(t('pairingErrorLimit'));
        } else if (msg.includes('INVALID_OR_EXPIRED_PAIRING_CODE')) {
          setPairingClaimError(t('pairingErrorInvalid'));
        } else {
          setPairingClaimError(msg);
        }
        return;
      }
      void import('canvas-confetti').then((mod) => {
        mod.default({
          particleCount: 140,
          spread: 72,
          origin: { y: 0.58 },
        });
      });
      setPairingLinkSuccess(true);
      await reloadScreens();
      bumpWorkspaceDataEpoch();
      if (pairingSuccessTimerRef.current) clearTimeout(pairingSuccessTimerRef.current);
      pairingSuccessTimerRef.current = setTimeout(() => {
        pairingSuccessTimerRef.current = null;
        setPairingModalOpen(false);
        setPairingLinkSuccess(false);
        setPlayerPairCode('');
        setPlayerPairName('');
        setPairingClaimError(null);
      }, 2000);
    } finally {
      setPlayerPairBusy(false);
    }
  }, [
    workspaceIdParam,
    canClaimPlayerPairing,
    playerPairCode,
    playerPairName,
    t,
    reloadScreens,
    bumpWorkspaceDataEpoch,
  ]);

  const duplicatePlaylist = useCallback(
    async (pl: BranchPlaylistRow) => {
      if (!workspaceIdParam) return;
      setDuplicatePlaylistBusyId(pl.id);
      try {
        const res = await apiFetch(
          `/playlists/${encodeURIComponent(pl.id)}/duplicate?workspaceId=${encodeURIComponent(workspaceIdParam)}`,
          { method: 'POST' },
        );
        if (!res.ok) {
          toast.error(await readApiErrorMessage(res));
          return;
        }
        toast.success(t('playlistDuplicated'));
        await loadPlaylists();
        bumpWorkspaceDataEpoch();
      } finally {
        setDuplicatePlaylistBusyId(null);
      }
    },
    [workspaceIdParam, t, loadPlaylists, bumpWorkspaceDataEpoch],
  );

  const confirmDeletePlaylist = useCallback(async () => {
    if (!playlistToDelete || !workspaceIdParam) return;
    setDeletePlaylistBusy(true);
    try {
      const forceQ = playlistDeleteForce ? '&force=true' : '';
      const res = await apiFetch(
        `/playlists/${encodeURIComponent(playlistToDelete.id)}?workspaceId=${encodeURIComponent(workspaceIdParam)}${forceQ}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        toast.error(await readApiErrorMessage(res));
        return;
      }
      toast.success(t('playlistDeleted'));
      setPlaylistToDelete(null);
      setPlaylistDeleteForce(false);
      await loadPlaylists();
      bumpWorkspaceDataEpoch();
    } finally {
      setDeletePlaylistBusy(false);
    }
  }, [
    playlistToDelete,
    playlistDeleteForce,
    workspaceIdParam,
    t,
    loadPlaylists,
    bumpWorkspaceDataEpoch,
  ]);

  const confirmMovePlaylist = useCallback(async () => {
    if (!playlistToMove || !workspaceIdParam || !moveTargetId) return;
    if (moveTargetId === workspaceIdParam) {
      toast.error(t('playlistMoveChooseBranch'));
      return;
    }
    setMoveBusy(true);
    try {
      const cloneRes = await apiFetch(
        `/playlists/${encodeURIComponent(playlistToMove.id)}/clone-to-workspace?workspaceId=${encodeURIComponent(workspaceIdParam)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetWorkspaceId: moveTargetId }),
        },
      );
      if (!cloneRes.ok) {
        toast.error(await readApiErrorMessage(cloneRes));
        return;
      }
      if (canDeletePlaylist) {
        const delRes = await apiFetch(
          `/playlists/${encodeURIComponent(playlistToMove.id)}?workspaceId=${encodeURIComponent(workspaceIdParam)}&force=true`,
          { method: 'DELETE' },
        );
        if (!delRes.ok) {
          toast.warning(
            t('playlistMovePartial', { message: await readApiErrorMessage(delRes) }),
          );
        } else {
          toast.success(t('playlistMoved'));
        }
      } else {
        toast.success(t('playlistClonedToBranch'));
      }
      setPlaylistToMove(null);
      setMoveTargetId('');
      await loadPlaylists();
      bumpWorkspaceDataEpoch();
    } finally {
      setMoveBusy(false);
    }
  }, [
    playlistToMove,
    workspaceIdParam,
    moveTargetId,
    canDeletePlaylist,
    t,
    loadPlaylists,
    bumpWorkspaceDataEpoch,
  ]);

  const savePlaylistEdit = useCallback(async () => {
    if (!playlistToEdit || !workspaceIdParam) return;
    const name = editPlaylistName.trim();
    if (!name) {
      toast.error(t('playlistNameRequired'));
      return;
    }
    setEditPlaylistSaving(true);
    try {
      const res = await apiFetch(
        `/playlists/${encodeURIComponent(playlistToEdit.id)}?workspaceId=${encodeURIComponent(workspaceIdParam)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, isPublished: editPlaylistPublished }),
        },
      );
      if (!res.ok) {
        toast.error(await readApiErrorMessage(res));
        return;
      }
      toast.success(t('playlistUpdated'));
      setPlaylistEditOpen(false);
      setPlaylistToEdit(null);
      await loadPlaylists();
      bumpWorkspaceDataEpoch();
    } finally {
      setEditPlaylistSaving(false);
    }
  }, [
    playlistToEdit,
    workspaceIdParam,
    editPlaylistName,
    editPlaylistPublished,
    t,
    loadPlaylists,
    bumpWorkspaceDataEpoch,
  ]);

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
    <main className="space-y-8 pb-12">
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

      {activeTab === 'playlists' ? (
      <section className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground dark:text-white">
              {t('playlistsTitle')}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('playlistsSub')}</p>
          </div>
          <button
            type="button"
            className={cn(
              'inline-flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition',
              'border-[#FF6B00]/25 bg-white/60 text-[#1B254B] hover:border-[#FF6B00]/50 hover:bg-[#FF6B00]/10',
              'dark:border-white/15 dark:bg-[#1B254B]/50 dark:text-white dark:hover:bg-[#FF6B00]/15',
            )}
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4 shrink-0 text-[#FF6B00]" strokeWidth={ICON_STROKE} />
            {t('addPlaylist')}
          </button>
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
              const dupBusy = duplicatePlaylistBusyId === pl.id;
              return (
                <motion.div
                  key={pl.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.03 * i, duration: 0.3 }}
                  className="group/card relative"
                >
                  <Link
                    href={`/${locale}/branches/${workspaceIdParam}/playlists/${pl.id}` as Route}
                    className={cn(
                      'flex flex-col rounded-2xl border border-border/60 bg-card/50 p-5 pe-12 transition-all duration-300',
                      'hover:-translate-y-0.5 hover:border-[#FF6B00]/45 hover:bg-[#FF6B00]/[0.06] hover:shadow-lg hover:shadow-[#FF6B00]/10',
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
                  {canEditPlaylist ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute end-2 top-2 z-20 h-9 w-9 rounded-xl text-muted-foreground hover:bg-[#FF6B00]/12 hover:text-foreground"
                          aria-label={t('playlistActionsAria')}
                          onClick={(e) => e.preventDefault()}
                        >
                          {dupBusy ? (
                            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={ICON_STROKE} />
                          ) : (
                            <MoreVertical className="h-4 w-4" strokeWidth={ICON_STROKE} />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[12rem]">
                        <DropdownMenuItem
                          className="gap-2 font-semibold"
                          disabled={dupBusy}
                          onClick={() => void duplicatePlaylist(pl)}
                        >
                          <Copy className="h-4 w-4 text-[#FF6B00]" strokeWidth={ICON_STROKE} />
                          {t('playlistDuplicate')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="gap-2 font-semibold"
                          onClick={() => {
                            setPlaylistToEdit(pl);
                            setEditPlaylistName(pl.name);
                            setEditPlaylistPublished(pl.isPublished === true);
                            setPlaylistEditOpen(true);
                          }}
                        >
                          <PenLine className="h-4 w-4 text-[#FF6B00]" strokeWidth={ICON_STROKE} />
                          {t('playlistEdit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="gap-2 font-semibold"
                          onClick={() => {
                            setPlaylistToMove(pl);
                            setMoveTargetId('');
                          }}
                        >
                          <Monitor className="h-4 w-4 text-[#FF6B00]" strokeWidth={ICON_STROKE} />
                          {t('playlistMoveToBranch')}
                        </DropdownMenuItem>
                        {canDeletePlaylist ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="gap-2 font-semibold text-red-600 focus:text-red-600"
                              onClick={() => setPlaylistToDelete(pl)}
                            >
                              <Trash2 className="h-4 w-4" strokeWidth={ICON_STROKE} />
                              {t('playlistDelete')}
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </motion.div>
              );
            })}
          </div>
        )}
      </section>
      ) : null}

      {activeTab === 'screens' ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground dark:text-white">
              {t('screensTitle')}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('screensSub')}</p>
          </div>
          {screensLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-10 w-10 animate-spin text-[#FF6B00]" />
            </div>
          ) : screens.length === 0 ? (
            <div className="vc-card-surface rounded-2xl border border-dashed border-[#FF6B00]/25 p-10 text-center">
              <Monitor className="mx-auto h-10 w-10 text-[#FF6B00]/70" strokeWidth={ICON_STROKE} />
              <p className="mt-3 text-sm font-medium text-foreground dark:text-white">{t('noScreens')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {screens.map((screen) => (
                <div
                  key={screen.id}
                  className="vc-card-surface rounded-2xl border border-border/60 p-4 dark:border-white/10"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-foreground dark:text-white">{screen.name}</p>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">{screen.serialNumber}</p>
                    </div>
                    <ScreenFleetStatusBadge
                      tone="card"
                      status={screen.status}
                      lastSeenAt={screen.lastSeenAt}
                      locale={locale}
                      className="items-end"
                    />
                  </div>
                  <div className="mt-3 space-y-1.5">
                    <Label
                      htmlFor={`screen-pl-${screen.id}`}
                      className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                    >
                      {t('screenPlaybackPlaylist')}
                    </Label>
                    <div className="relative">
                      <select
                        id={`screen-pl-${screen.id}`}
                        className={cn(
                          'h-10 w-full cursor-pointer appearance-none rounded-xl border border-input bg-background px-3 pe-9 text-sm outline-none',
                          'focus-visible:ring-2 focus-visible:ring-[#FF6B00]/35',
                          'disabled:cursor-not-allowed disabled:opacity-50',
                        )}
                        disabled={!canEditPlaylist || assignPlaybackScreenId === screen.id}
                        value={screen.activePlaylistId ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          void assignScreenPlaybackPlaylist(screen.id, v || null);
                        }}
                      >
                        <option value="">{t('screenPlaybackNone')}</option>
                        {playlists.map((pl) => (
                          <option key={pl.id} value={pl.id}>
                            {pl.name}
                          </option>
                        ))}
                      </select>
                      {assignPlaybackScreenId === screen.id ? (
                        <span className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2">
                          <Loader2 className="h-4 w-4 animate-spin text-[#FF6B00]" strokeWidth={ICON_STROKE} />
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="rounded-lg bg-[#FF6B00] px-3 text-amber-950 hover:bg-[#FF6B00]/90"
                      onClick={() => {
                        setEditScreen(screen);
                        setEditOpen(true);
                      }}
                    >
                      {t('screenQuickEdit')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-lg"
                      onClick={() => {
                        window.location.assign(`/${locale}/studio`);
                      }}
                    >
                      <PenLine className="me-1 h-3.5 w-3.5" />
                      {t('screenFullEditor')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="rounded-lg text-red-500 hover:bg-red-500/10 hover:text-red-600"
                      onClick={async () => {
                        const ok = window.confirm(t('screenDeleteConfirm'));
                        if (!ok) return;
                        const res = await apiFetch(
                          `/screens/${encodeURIComponent(screen.id)}?workspaceId=${encodeURIComponent(workspaceIdParam)}`,
                          { method: 'DELETE' },
                        );
                        if (!res.ok) {
                          toast.error(await readApiErrorMessage(res));
                          return;
                        }
                        toast.success(t('screenDeleted'));
                        await reloadScreens();
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {activeTab === 'media' ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground dark:text-white">
              {t('mediaTitle')}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('mediaSub')}</p>
          </div>
          {mediaLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-10 w-10 animate-spin text-[#FF6B00]" />
            </div>
          ) : mediaItems.length === 0 ? (
            <div className="vc-card-surface rounded-2xl border border-dashed border-[#FF6B00]/25 p-10 text-center">
              <ImageIcon className="mx-auto h-10 w-10 text-[#FF6B00]/70" strokeWidth={ICON_STROKE} />
              <p className="mt-3 text-sm font-medium text-foreground dark:text-white">{t('noMedia')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {mediaItems.map((item) => (
                <div
                  key={item.id}
                  className="vc-card-surface rounded-2xl border border-border/60 p-4 dark:border-white/10"
                >
                  <p className="truncate text-sm font-semibold text-foreground dark:text-white">{item.originalName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.mimeType}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <Dialog
        open={pairingModalOpen}
        onOpenChange={(open) => {
          setPairingModalOpen(open);
          if (!open) {
            if (pairingSuccessTimerRef.current) {
              clearTimeout(pairingSuccessTimerRef.current);
              pairingSuccessTimerRef.current = null;
            }
            setPlayerPairCode('');
            setPlayerPairName('');
            setPairingClaimError(null);
            setPairingLinkSuccess(false);
          }
        }}
      >
        <DialogContent className="max-h-[min(90vh,560px)] overflow-y-auto sm:max-w-md">
          <DialogHeader className="space-y-1 text-center sm:text-center">
            <DialogTitle className="text-xl font-semibold">{t('pairingModalTitle')}</DialogTitle>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {tToolbar('branchLabel')} · {branch.name}
            </p>
          </DialogHeader>
          {pairingModalOpen && pairingActivityEpoch > pairingModalBaseEpochRef.current ? (
            <p
              role="status"
              className="rounded-xl border border-[#FF6B00]/40 bg-[#FF6B00]/12 px-3 py-2 text-center text-xs font-medium leading-relaxed text-foreground dark:text-amber-50"
            >
              {t('pairingProgressBanner')}
            </p>
          ) : null}
          <div className="space-y-5 py-2">
            {pairingLinkSuccess ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <CheckCircle2
                  className="h-14 w-14 text-emerald-500"
                  strokeWidth={ICON_STROKE}
                  aria-hidden
                />
                <p className="text-base font-semibold text-foreground dark:text-white">
                  {t('pairingSuccessMessage')}
                </p>
              </div>
            ) : !canClaimPlayerPairing ? (
              <p className="text-center text-sm text-muted-foreground">{t('pairingViewOnly')}</p>
            ) : (
              <>
                <p className="text-center text-sm leading-relaxed text-muted-foreground">
                  {t('pairingModalDescription')}
                </p>
                {pairingClaimError ? (
                  <p
                    className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive"
                    role="alert"
                  >
                    {pairingClaimError}
                  </p>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="player-pair-code" className="sr-only">
                    {t('pairingCodeFieldLabel')}
                  </Label>
                  <p className="text-center text-xs font-medium text-muted-foreground">
                    {t('pairingCodeFieldLabel')}
                  </p>
                  <Input
                    id="player-pair-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder={t('pairingCodePlaceholder')}
                    value={playerPairCode}
                    onChange={(e) =>
                      setPlayerPairCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    className="h-14 rounded-xl text-center font-mono text-3xl font-semibold tracking-[0.35em] text-foreground"
                    aria-invalid={Boolean(pairingClaimError)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="player-pair-name">{t('pairingNameFieldLabel')}</Label>
                  <Input
                    id="player-pair-name"
                    value={playerPairName}
                    onChange={(e) => setPlayerPairName(e.target.value)}
                    placeholder={t('pairingNamePlaceholder')}
                    className="rounded-xl"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void claimPlayerPairing();
                    }}
                  />
                </div>
                <Button
                  type="button"
                  className="h-11 w-full rounded-xl bg-[#FF6B00] font-semibold text-amber-950 hover:bg-[#FF6B00]/90"
                  disabled={
                    playerPairBusy || playerPairCode.replace(/\D/g, '').length !== 6
                  }
                  onClick={() => void claimPlayerPairing()}
                >
                  {playerPairBusy ? (
                    <span className="inline-flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" strokeWidth={ICON_STROKE} />
                    </span>
                  ) : (
                    t('pairingCompleteButton')
                  )}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={playlistEditOpen}
        onOpenChange={(open) => {
          setPlaylistEditOpen(open);
          if (!open) setPlaylistToEdit(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('playlistEditTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="pl-edit-name">{t('playlistNameLabel')}</Label>
              <Input
                id="pl-edit-name"
                value={editPlaylistName}
                onChange={(e) => setEditPlaylistName(e.target.value)}
                className="rounded-xl"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void savePlaylistEdit();
                }}
              />
            </div>
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-input accent-[#FF6B00]"
                checked={editPlaylistPublished}
                onChange={(e) => setEditPlaylistPublished(e.target.checked)}
              />
              <span>
                <span className="font-medium text-foreground dark:text-white">{t('playlistPublishedLabel')}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{t('playlistPublishedHint')}</span>
              </span>
            </label>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                setPlaylistEditOpen(false);
                setPlaylistToEdit(null);
              }}
            >
              {t('cancel')}
            </Button>
            <Button
              type="button"
              className="rounded-xl bg-[#FF6B00] font-semibold text-amber-950"
              disabled={editPlaylistSaving || !editPlaylistName.trim()}
              onClick={() => void savePlaylistEdit()}
            >
              {editPlaylistSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={ICON_STROKE} />
              ) : (
                t('playlistEditSave')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      <Dialog
        open={playlistToMove !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPlaylistToMove(null);
            setMoveTargetId('');
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('playlistMoveTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm leading-relaxed text-muted-foreground">{t('playlistMoveHint')}</p>
          <div className="space-y-2 py-2">
            <Label htmlFor="move-branch">{t('playlistMoveTargetLabel')}</Label>
            <select
              id="move-branch"
              className={cn(
                'flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background',
                'focus-visible:outline focus-visible:ring-2 focus-visible:ring-[#FF6B00]/40',
              )}
              value={moveTargetId}
              onChange={(e) => setMoveTargetId(e.target.value)}
            >
              <option value="">{t('playlistMoveChooseBranch')}</option>
              {workspaces
                .filter((w) => w.id !== workspaceIdParam)
                .map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
            </select>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                setPlaylistToMove(null);
                setMoveTargetId('');
              }}
            >
              {t('cancel')}
            </Button>
            <Button
              type="button"
              className="rounded-xl bg-[#FF6B00] font-semibold text-amber-950 hover:bg-[#FF6B00]/90"
              disabled={!moveTargetId || moveBusy || workspaces.filter((w) => w.id !== workspaceIdParam).length === 0}
              onClick={() => void confirmMovePlaylist()}
            >
              {moveBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={ICON_STROKE} />
              ) : canDeletePlaylist ? (
                t('playlistMoveConfirm')
              ) : (
                t('playlistMoveCopyOnly')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={playlistToDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPlaylistToDelete(null);
            setPlaylistDeleteForce(false);
          }
        }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('playlistDeleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {playlistDeleteForce ? t('playlistDeleteBodyForce') : t('playlistDeleteBody')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="flex cursor-pointer items-start gap-3 px-1 text-sm">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-input accent-[#FF6B00]"
              checked={playlistDeleteForce}
              onChange={(e) => setPlaylistDeleteForce(e.target.checked)}
            />
            <span>
              <span className="font-medium text-foreground dark:text-white">{t('playlistDeleteForceLabel')}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{t('playlistDeleteForceHint')}</span>
            </span>
          </label>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel className="rounded-xl" disabled={deletePlaylistBusy}>
              {t('cancel')}
            </AlertDialogCancel>
            <Button
              type="button"
              className="rounded-xl bg-red-600 font-semibold text-white hover:bg-red-600/90"
              disabled={deletePlaylistBusy}
              onClick={() => void confirmDeletePlaylist()}
            >
              {deletePlaylistBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={ICON_STROKE} />
              ) : (
                t('playlistDelete')
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ScreenQuickEditPanel
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditScreen(null);
        }}
        screen={editScreen}
        workspaceId={workspaceIdParam}
        locale={locale}
        onSaved={reloadScreens}
        onEditScreen={() => {
          window.location.assign(`/${locale}/studio`);
        }}
      />
    </main>
  );
}
