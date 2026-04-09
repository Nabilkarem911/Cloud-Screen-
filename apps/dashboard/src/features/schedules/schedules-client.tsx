'use client';

import { motion } from 'framer-motion';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { CalendarClock, Loader2, Play, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/features/auth/session';
import { useWorkspace } from '@/features/workspace/workspace-context';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import {
  formatHHmm,
  heightPxForSegment,
  parseHHmm,
  segmentsForColumn,
  shiftSameDayWindow,
  topPxForMinute,
} from './schedule-calendar-utils';

const PX_PER_HOUR = 40;
const TOTAL_H = 24 * PX_PER_HOUR;

type ScheduleApi = {
  id: string;
  workspaceId: string;
  screenId: string | null;
  playlistId: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  startDate: string | null;
  endDate: string | null;
  priority: number;
  enabled: boolean;
  playlist: { id: string; name: string };
  screen: { id: string; name: string } | null;
};

type PlaylistOpt = { id: string; name: string; _count?: { items: number } };
type ScreenOpt = { id: string; name: string };

export function SchedulesClient({ locale }: { locale: string }) {
  const t = useTranslations('schedules');
  const { workspaceId } = useWorkspace();
  const [schedules, setSchedules] = useState<ScheduleApi[]>([]);
  const [pairs, setPairs] = useState<Array<[string, string]>>([]);
  const [playlists, setPlaylists] = useState<PlaylistOpt[]>([]);
  const [screens, setScreens] = useState<ScreenOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);

  const overlapIds = useMemo(() => {
    const s = new Set<string>();
    for (const [a, b] of pairs) {
      s.add(a);
      s.add(b);
    }
    return s;
  }, [pairs]);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const [sRes, oRes, pRes, scRes] = await Promise.all([
        apiFetch(`/schedules?workspaceId=${encodeURIComponent(workspaceId)}`),
        apiFetch(`/schedules/overlaps?workspaceId=${encodeURIComponent(workspaceId)}`),
        apiFetch(`/playlists?workspaceId=${encodeURIComponent(workspaceId)}`),
        apiFetch(`/screens?workspaceId=${encodeURIComponent(workspaceId)}&page=1&limit=200`),
      ]);
      if (sRes.ok) setSchedules((await sRes.json()) as ScheduleApi[]);
      if (oRes.ok) {
        const o = (await oRes.json()) as { pairs: Array<[string, string]> };
        setPairs(o.pairs ?? []);
      }
      if (pRes.ok) setPlaylists((await pRes.json()) as PlaylistOpt[]);
      if (scRes.ok) {
        const body = (await scRes.json()) as { items: ScreenOpt[] };
        setScreens(body.items ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const dayShort = useCallback(
    (dow: number) => {
      const base = new Date(Date.UTC(2024, 0, 7 + dow));
      return new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en', {
        weekday: 'short',
      }).format(base);
    },
    [locale],
  );

  const dragRef = useRef<{
    id: string;
    startY: number;
    origStart: string;
    origEnd: string;
    currentStart: string;
    currentEnd: string;
  } | null>(null);

  const [dragActive, setDragActive] = useState(false);

  const onPointerMove = useCallback((e: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dy = e.clientY - d.startY;
    const deltaMin = Math.round((dy / PX_PER_HOUR) * 60);
    const next = shiftSameDayWindow(d.origStart, d.origEnd, deltaMin);
    if (!next) return;
    d.currentStart = next.startTime;
    d.currentEnd = next.endTime;
    setSchedules((prev) =>
      prev.map((s) =>
        s.id === d.id ? { ...s, startTime: next.startTime, endTime: next.endTime } : s,
      ),
    );
  }, []);

  const endDrag = useCallback(async () => {
    const d = dragRef.current;
    dragRef.current = null;
    setDragActive(false);
    if (!d || !workspaceId) return;
    if (d.currentStart === d.origStart && d.currentEnd === d.origEnd) return;
    const res = await apiFetch(
      `/schedules/${d.id}?workspaceId=${encodeURIComponent(workspaceId)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startTime: d.currentStart,
          endTime: d.currentEnd,
        }),
      },
    );
    if (!res.ok) {
      toast.error(t('saveFailed'));
      await load();
      return;
    }
    toast.success(t('saved'));
    await load();
  }, [workspaceId, load, t]);

  useEffect(() => {
    if (!dragActive) return;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
    };
  }, [dragActive, onPointerMove, endDrag]);

  const [overrideScreenId, setOverrideScreenId] = useState('');
  const [overridePlaylistId, setOverridePlaylistId] = useState('');

  const applyOverride = async () => {
    if (!workspaceId || !overrideScreenId || !overridePlaylistId) {
      toast.error(t('overrideNeed'));
      return;
    }
    const res = await apiFetch(
      `/screens/${overrideScreenId}/override?workspaceId=${encodeURIComponent(workspaceId)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlistId: overridePlaylistId, durationMinutes: 480 }),
      },
    );
    if (!res.ok) {
      toast.error(t('overrideFailed'));
      return;
    }
    toast.success(t('overrideOk'));
  };

  if (!workspaceId) {
    return (
      <p className="text-sm text-muted-foreground">{t('needWorkspace')}</p>
    );
  }

  return (
    <div className="space-y-8">
      <section className="vc-glass vc-card-surface rounded-3xl p-6 shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF6B00] to-[#CC4400] shadow-lg shadow-[#0F1729]/30">
              <CalendarClock className="h-6 w-6 text-white" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">{t('engineTitle')}</h2>
              <p className="text-sm text-muted-foreground">{t('engineDesc')}</p>
            </div>
          </div>
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button className="rounded-2xl bg-[#0F1729] hover:bg-[#0F1729]/90">
                <Plus className="me-2 h-4 w-4" />
                {t('addSchedule')}
              </Button>
            </DialogTrigger>
            <CreateScheduleForm
              locale={locale}
              workspaceId={workspaceId}
              playlists={playlists}
              screens={screens}
              onCreated={() => {
                setOpenCreate(false);
                void load();
                toast.success(t('saved'));
              }}
              onCancel={() => setOpenCreate(false)}
              t={t}
            />
          </Dialog>
        </div>

        <div className="mt-6 flex flex-wrap gap-4 text-xs">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#0F1729]/15 px-3 py-1 font-medium text-[#0F1729] ring-1 ring-[#0F1729]/25 dark:text-orange-200">
            <span className="h-2 w-2 rounded-full bg-[#0F1729]" />
            {t('legendScheduled')}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-[#FF6B00]/15 px-3 py-1 font-medium text-amber-900 ring-1 ring-[#FF6B00]/40 dark:text-amber-100">
            <span className="h-2 w-2 rounded-full bg-[#FF6B00]" />
            {t('legendOverlap')}
          </span>
        </div>
      </section>

      <section className="vc-glass vc-card-surface rounded-3xl p-6 shadow-xl">
        <h3 className="mb-4 text-base font-semibold tracking-tight">{t('overrideTitle')}</h3>
        <p className="mb-4 text-sm text-muted-foreground">{t('overrideDesc')}</p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-2">
            <Label>{t('fieldScreen')}</Label>
            <select
              className="h-10 min-w-[200px] rounded-xl border border-border bg-background/80 px-3 text-sm backdrop-blur"
              value={overrideScreenId}
              onChange={(e) => setOverrideScreenId(e.target.value)}
            >
              <option value="">{t('selectScreen')}</option>
              {screens.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label>{t('fieldPlaylist')}</Label>
            <select
              className="h-10 min-w-[200px] rounded-xl border border-border bg-background/80 px-3 text-sm backdrop-blur"
              value={overridePlaylistId}
              onChange={(e) => setOverridePlaylistId(e.target.value)}
            >
              <option value="">{t('selectPlaylist')}</option>
              {playlists.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            onClick={() => void applyOverride()}
            className="rounded-2xl bg-gradient-to-r from-[#FF6B00] to-amber-500 font-semibold text-amber-950 shadow-md hover:opacity-95"
          >
            <Play className="me-2 h-4 w-4" />
            {t('overrideCta')}
          </Button>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-card/90 to-card/40 p-4 shadow-2xl backdrop-blur-xl dark:from-card/60 dark:to-card/30 sm:p-6">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            {t('loading')}
          </div>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-2">
            <div
              className="sticky start-0 z-20 flex shrink-0 flex-col border-e border-border/60 pe-2 text-[11px] text-muted-foreground"
              style={{ width: 48, height: TOTAL_H + 28 }}
            >
              <div className="h-7 shrink-0" />
              {Array.from({ length: 24 }, (_, h) => (
                <div
                  key={h}
                  className="flex shrink-0 items-start justify-end border-t border-border/30 pt-0.5"
                  style={{ height: PX_PER_HOUR }}
                >
                  {formatHHmm(h * 60)}
                </div>
              ))}
            </div>

            <div className="flex min-w-0 flex-1 gap-1">
              {[0, 1, 2, 3, 4, 5, 6].map((dow) => (
                <div
                  key={dow}
                  className="relative min-w-[100px] flex-1 rounded-2xl border border-white/5 bg-black/[0.02] dark:bg-white/[0.02]"
                  style={{ height: TOTAL_H + 28 }}
                >
                  <div className="sticky top-0 z-10 mb-1 flex h-7 items-center justify-center rounded-t-xl bg-gradient-to-b from-[#0F1729]/12 to-transparent text-center text-xs font-semibold text-foreground">
                    {dayShort(dow)}
                  </div>
                  <div
                    className="relative mx-0.5 rounded-xl border border-white/5"
                    style={{ height: TOTAL_H }}
                  >
                    {Array.from({ length: 24 }, (_, h) => (
                      <div
                        key={h}
                        className="absolute start-0 end-0 border-t border-dashed border-white/5"
                        style={{ top: h * PX_PER_HOUR }}
                      />
                    ))}
                    {schedules.flatMap((sch) => {
                      const segs = segmentsForColumn(
                        sch.daysOfWeek,
                        sch.startTime,
                        sch.endTime,
                        dow,
                      );
                      return segs.map((seg, idx) => {
                        const hPx = heightPxForSegment(
                          seg.startMin,
                          seg.endMin,
                          PX_PER_HOUR,
                        );
                        const top = topPxForMinute(seg.startMin, PX_PER_HOUR);
                        const isOver = overlapIds.has(sch.id);
                        const canDrag =
                          parseHHmm(sch.startTime) < parseHHmm(sch.endTime);
                        return (
                          <motion.div
                            key={`${sch.id}-${dow}-${idx}`}
                            layout
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={cn(
                              'absolute start-0.5 end-0.5 cursor-grab overflow-hidden rounded-lg px-1.5 py-1 text-[10px] font-medium leading-tight text-white shadow-lg active:cursor-grabbing',
                              isOver
                                ? 'ring-2 ring-[#FF6B00] ring-offset-1 ring-offset-transparent'
                                : 'ring-1 ring-white/20',
                            )}
                            style={{
                              top,
                              height: Math.max(hPx, 18),
                              background: 'linear-gradient(135deg, #0F1729 0%, #6b21a8 100%)',
                            }}
                            title={`${sch.playlist.name} · ${sch.startTime}–${sch.endTime}`}
                            onPointerDown={(e) => {
                              if (!canDrag) return;
                              e.currentTarget.setPointerCapture(e.pointerId);
                              dragRef.current = {
                                id: sch.id,
                                startY: e.clientY,
                                origStart: sch.startTime,
                                origEnd: sch.endTime,
                                currentStart: sch.startTime,
                                currentEnd: sch.endTime,
                              };
                              setDragActive(true);
                            }}
                          >
                            <p className="truncate opacity-95">{sch.playlist.name}</p>
                            <p className="truncate text-[9px] opacity-75">
                              {sch.startTime} – {sch.endTime}
                            </p>
                          </motion.div>
                        );
                      });
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {!loading && schedules.length > 0 ? (
        <section className="vc-glass vc-card-surface rounded-3xl p-6">
          <h3 className="mb-4 text-base font-semibold">{t('listTitle')}</h3>
          <ul className="space-y-2">
            {schedules.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">{s.playlist.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.daysOfWeek.map((d) => dayShort(d)).join(', ')} · {s.startTime}–{s.endTime}{' '}
                    · P{s.priority}
                    {s.screen ? ` · ${s.screen.name}` : ` · ${t('allScreens')}`}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={async () => {
                    if (!workspaceId) return;
                    if (!confirm(t('confirmDelete'))) return;
                    const res = await apiFetch(
                      `/schedules/${s.id}?workspaceId=${encodeURIComponent(workspaceId)}`,
                      { method: 'DELETE' },
                    );
                    if (res.ok) {
                      toast.success(t('deleted'));
                      void load();
                    } else toast.error(t('deleteFailed'));
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function CreateScheduleForm({
  locale,
  workspaceId,
  playlists,
  screens,
  onCreated,
  onCancel,
  t,
}: {
  locale: string;
  workspaceId: string;
  playlists: PlaylistOpt[];
  screens: ScreenOpt[];
  onCreated: () => void;
  onCancel: () => void;
  t: (key: string) => string;
}) {
  const [playlistId, setPlaylistId] = useState('');
  const [screenId, setScreenId] = useState('');
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [priority, setPriority] = useState(10);
  const [saving, setSaving] = useState(false);

  const dayShort = (dow: number) => {
    const base = new Date(Date.UTC(2024, 0, 7 + dow));
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en', {
      weekday: 'short',
    }).format(base);
  };

  const toggleDay = (d: number) => {
    setDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b),
    );
  };

  const submit = async () => {
    if (!playlistId || days.length === 0) {
      toast.error(t('formInvalid'));
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch('/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          playlistId,
          screenId: screenId || null,
          daysOfWeek: days,
          startTime,
          endTime,
          priority,
        }),
      });
      if (!res.ok) {
        toast.error(t('saveFailed'));
        return;
      }
      onCreated();
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogContent className="max-w-lg rounded-3xl border border-white/10 bg-card/95 backdrop-blur-xl">
      <DialogHeader>
        <DialogTitle>{t('createTitle')}</DialogTitle>
        <DialogDescription>{t('createDesc')}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-2">
        <div className="grid gap-2">
          <Label>{t('fieldPlaylist')}</Label>
          <select
            className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
            value={playlistId}
            onChange={(e) => setPlaylistId(e.target.value)}
          >
            <option value="">{t('selectPlaylist')}</option>
            {playlists.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label>{t('fieldScreenOptional')}</Label>
          <select
            className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
            value={screenId}
            onChange={(e) => setScreenId(e.target.value)}
          >
            <option value="">{t('allScreens')}</option>
            {screens.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label>{t('fieldDays')}</Label>
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2, 3, 4, 5, 6].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(d)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                  days.includes(d)
                    ? 'bg-[#0F1729] text-white shadow-md'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
                )}
              >
                {dayShort(d)}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">{t('dayHint')}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label>{t('fieldStart')}</Label>
            <Input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="grid gap-2">
            <Label>{t('fieldEnd')}</Label>
            <Input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="rounded-xl"
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label>{t('fieldPriority')}</Label>
          <Input
            type="number"
            min={0}
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            className="rounded-xl"
          />
        </div>
      </div>
      <DialogFooter className="gap-2 sm:gap-0">
        <Button type="button" variant="outline" className="rounded-2xl" onClick={onCancel}>
          {t('cancel')}
        </Button>
        <Button
          type="button"
          disabled={saving}
          className="rounded-2xl bg-[#0F1729] hover:bg-[#0F1729]/90"
          onClick={() => void submit()}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('save')}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
