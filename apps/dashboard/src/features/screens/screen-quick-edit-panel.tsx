'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarClock, FolderKanban, ListMusic, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/features/auth/session';
import { cn } from '@/lib/utils';
import type { ScreenRow } from './useApiScreens';

type PlaylistOpt = { id: string; name: string };
type ScheduleOpt = {
  id: string;
  screenId: string | null;
  playlist: { id: string; name: string };
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  screen: ScreenRow | null;
  workspaceId: string;
  locale: string;
  onSaved: () => Promise<void>;
  onEditScreen: () => void;
};

export function ScreenQuickEditPanel({
  open,
  onOpenChange,
  screen,
  workspaceId,
  locale,
  onSaved,
  onEditScreen,
}: Props) {
  const t = useTranslations('screenQuickEditPanel');
  const [playlists, setPlaylists] = useState<PlaylistOpt[]>([]);
  const [schedules, setSchedules] = useState<ScheduleOpt[]>([]);
  const [playlistId, setPlaylistId] = useState<string>('');
  const [scheduleId, setScheduleId] = useState<string>('');
  const [playlistGroupId, setPlaylistGroupId] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const loadOptions = useCallback(async () => {
    const [plRes, schRes] = await Promise.all([
      apiFetch(`/playlists?workspaceId=${encodeURIComponent(workspaceId)}`),
      apiFetch(`/schedules?workspaceId=${encodeURIComponent(workspaceId)}`),
    ]);
    if (plRes.ok) {
      const rows = (await plRes.json()) as PlaylistOpt[];
      setPlaylists(Array.isArray(rows) ? rows : []);
    }
    if (schRes.ok) {
      const rows = (await schRes.json()) as ScheduleOpt[];
      setSchedules(Array.isArray(rows) ? rows : []);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!open || !screen) return;
    setPlaylistId(screen.activePlaylistId ?? '');
    setPlaylistGroupId(screen.playlistGroupId ?? '');
    void loadOptions();
  }, [open, screen, loadOptions]);

  useEffect(() => {
    if (!open || !screen) return;
    const match = schedules.find((s) => s.screenId === screen.id);
    setScheduleId(match?.id ?? '');
  }, [open, screen, schedules]);

  const applyPlaylistGroup = async (nextId: string) => {
    if (!screen) return;
    setBusy(true);
    try {
      const res = await apiFetch(
        `/screens/${screen.id}?workspaceId=${encodeURIComponent(workspaceId)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            playlistGroupId: nextId || null,
          }),
        },
      );
      if (!res.ok) {
        toast.error(t('couldNotUpdatePlaylistGroup'));
        return;
      }
      toast.success(t('playlistGroupAssigned'));
      setPlaylistGroupId(nextId);
      await onSaved();
    } finally {
      setBusy(false);
    }
  };

  const applyPlaylist = async (nextId: string) => {
    if (!screen) return;
    setBusy(true);
    try {
      const res = await apiFetch(
        `/screens/${screen.id}?workspaceId=${encodeURIComponent(workspaceId)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            activePlaylistId: nextId || null,
          }),
        },
      );
      if (!res.ok) {
        toast.error(t('couldNotUpdatePlaylist'));
        return;
      }
      toast.success(t('playlistAssigned'));
      setPlaylistId(nextId);
      await onSaved();
    } finally {
      setBusy(false);
    }
  };

  const applyScheduleTarget = async (schId: string) => {
    if (!screen) return;
    setBusy(true);
    try {
      const targeting = schedules.filter((s) => s.screenId === screen.id);
      for (const s of targeting) {
        const clr = await apiFetch(
          `/schedules/${s.id}?workspaceId=${encodeURIComponent(workspaceId)}`,
          {
            method: 'PATCH',
            body: JSON.stringify({ screenId: null }),
          },
        );
        if (!clr.ok) {
          toast.error(t('couldNotUpdateSchedule'));
          setBusy(false);
          return;
        }
      }
      if (!schId) {
        toast.success(t('scheduleCleared'));
        setScheduleId('');
        await onSaved();
        await loadOptions();
        return;
      }
      const res = await apiFetch(
        `/schedules/${schId}?workspaceId=${encodeURIComponent(workspaceId)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ screenId: screen.id }),
        },
      );
      if (!res.ok) {
        toast.error(t('couldNotAttachSchedule'));
        return;
      }
      toast.success(t('schedulePinned'));
      setScheduleId(schId);
      await onSaved();
      await loadOptions();
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && screen ? (
        <>
          <motion.button
            type="button"
            aria-label={t('closePanel')}
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
          />
          <motion.aside
            role="dialog"
            aria-modal
            className={cn(
              'fixed inset-y-0 z-[70] flex w-full max-w-md flex-col border-l border-white/15 bg-background/80 shadow-2xl backdrop-blur-2xl dark:bg-background/70',
              'end-0',
            )}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/10 px-6 py-5">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  {t('quickEdit')}
                </p>
                <h2 className="mt-1 truncate text-lg font-semibold tracking-tight">{screen.name}</h2>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">{screen.serialNumber}</p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="shrink-0 rounded-xl"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-semibold">
                  <FolderKanban className="h-4 w-4 text-[#0F1729]" />
                  {t('screenPlaylistGroup')}
                </Label>
                <select
                  className="h-11 w-full rounded-2xl border border-white/15 bg-white/5 px-3 text-[15px] font-medium outline-none ring-0 focus:border-[#0F1729]/40 focus:ring-2 focus:ring-[#0F1729]/20"
                  value={playlistGroupId}
                  disabled={busy}
                  onChange={(e) => {
                    const v = e.target.value;
                    setPlaylistGroupId(v);
                    void applyPlaylistGroup(v);
                  }}
                >
                  <option value="">{t('noPlaylistGroupOption')}</option>
                  {playlists.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <p className="text-[12px] text-muted-foreground">{t('screenPlaylistGroupHint')}</p>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-semibold">
                  <ListMusic className="h-4 w-4 text-[#0F1729]" />
                  {t('activePlaylist')}
                </Label>
                <select
                  className="h-11 w-full rounded-2xl border border-white/15 bg-white/5 px-3 text-[15px] font-medium outline-none ring-0 focus:border-[#0F1729]/40 focus:ring-2 focus:ring-[#0F1729]/20"
                  value={playlistId}
                  disabled={busy}
                  onChange={(e) => {
                    const v = e.target.value;
                    setPlaylistId(v);
                    void applyPlaylist(v);
                  }}
                >
                  <option value="">{t('noneOption')}</option>
                  {playlists.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <p className="text-[12px] text-muted-foreground">
                  {t('activePlaylistHint')}
                </p>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-semibold">
                  <CalendarClock className="h-4 w-4 text-[#0F1729]" />
                  {t('scheduleFocus')}
                </Label>
                <select
                  className="h-11 w-full rounded-2xl border border-white/15 bg-white/5 px-3 text-[15px] font-medium outline-none focus:border-[#0F1729]/40 focus:ring-2 focus:ring-[#0F1729]/20"
                  value={scheduleId}
                  disabled={busy}
                  onChange={(e) => {
                    const v = e.target.value;
                    setScheduleId(v);
                    void applyScheduleTarget(v);
                  }}
                >
                  <option value="">{t('clearScheduleOption')}</option>
                  {schedules.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.playlist?.name ?? s.id}
                      {s.screenId === screen.id ? t('thisScreenSuffix') : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[12px] text-muted-foreground">
                  {t('scheduleFocusHint')}
                </p>
              </div>

              <div className="flex flex-col gap-2 border-t border-white/10 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full rounded-2xl border-white/20"
                  onClick={() => {
                    onEditScreen();
                    onOpenChange(false);
                  }}
                >
                  {t('openScreenSettings')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 w-full rounded-2xl text-[#0F1729] hover:bg-[#0F1729]/10"
                  asChild
                >
                  <Link href={`/${locale}/schedules` as Route}>{t('openScheduleEngine')}</Link>
                </Button>
              </div>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
