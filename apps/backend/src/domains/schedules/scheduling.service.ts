import { Injectable } from '@nestjs/common';
import { formatInTimeZone } from 'date-fns-tz';
import { enUS } from 'date-fns/locale';
import type { Schedule } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

const WEEKDAY_NAME_TO_DOW: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

function parseHHmm(s: string): number {
  const [h, m] = s.split(':').map((x) => parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

/** Current minute-of-day and weekday (0=Sun..6=Sat) in `timeZone`. */
function nowInWorkspaceTz(at: Date, timeZone: string): { minutes: number; dow: number } {
  const timeStr = formatInTimeZone(at, timeZone, 'HH:mm');
  const [hh, mm] = timeStr.split(':').map((x) => parseInt(x, 10));
  const minutes = hh * 60 + mm;

  const dayName = formatInTimeZone(at, timeZone, 'EEEE', { locale: enUS });
  const dow = WEEKDAY_NAME_TO_DOW[dayName] ?? 0;

  return { minutes, dow };
}

function dateOnlyInTz(at: Date, timeZone: string): string {
  return formatInTimeZone(at, timeZone, 'yyyy-MM-dd');
}

function isDateInRange(
  at: Date,
  timeZone: string,
  startDate: Date | null,
  endDate: Date | null,
): boolean {
  const today = dateOnlyInTz(at, timeZone);
  if (startDate) {
    const s = formatInTimeZone(startDate, timeZone, 'yyyy-MM-dd');
    if (today < s) return false;
  }
  if (endDate) {
    const e = formatInTimeZone(endDate, timeZone, 'yyyy-MM-dd');
    if (today > e) return false;
  }
  return true;
}

/**
 * Window [startMin, endMin) may cross midnight if endMin <= startMin (e.g. 22:00–06:00).
 */
function isMinuteInWindow(nowMin: number, startMin: number, endMin: number): boolean {
  if (startMin === endMin) return false;
  if (startMin < endMin) {
    return nowMin >= startMin && nowMin < endMin;
  }
  return nowMin >= startMin || nowMin < endMin;
}

@Injectable()
export class SchedulingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Effective playlist id for playback: override → highest-priority matching schedule → default (activePlaylistId).
   */
  async resolveEffectivePlaylistId(
    screenId: string,
    at: Date = new Date(),
  ): Promise<{ playlistId: string | null; source: 'override' | 'schedule' | 'default' }> {
    const screen = await this.prisma.screen.findUnique({
      where: { id: screenId },
      include: { workspace: true },
    });
    if (!screen) {
      return { playlistId: null, source: 'default' };
    }

    if (
      screen.overridePlaylistId &&
      screen.overrideExpiresAt &&
      screen.overrideExpiresAt > at
    ) {
      return { playlistId: screen.overridePlaylistId, source: 'override' };
    }

    const tz = screen.workspace.timezone || 'UTC';

    const schedules = await this.prisma.schedule.findMany({
      where: {
        workspaceId: screen.workspaceId,
        enabled: true,
        OR: [{ screenId: null }, { screenId: screen.id }],
      },
    });

    const { minutes, dow } = nowInWorkspaceTz(at, tz);

    const matching = schedules
      .filter((s) => this.scheduleMatches(s, at, tz, minutes, dow))
      .sort((a, b) => b.priority - a.priority || (a.updatedAt > b.updatedAt ? -1 : 1));

    if (matching.length > 0) {
      const best = matching[0];
      return { playlistId: best.playlistId, source: 'schedule' };
    }

    return { playlistId: screen.activePlaylistId, source: 'default' };
  }

  scheduleMatches(
    s: Schedule,
    at: Date,
    timeZone: string,
    minutes: number,
    dow: number,
  ): boolean {
    if (!s.daysOfWeek.includes(dow)) return false;
    if (!isDateInRange(at, timeZone, s.startDate, s.endDate)) return false;

    const startMin = parseHHmm(s.startTime);
    const endMin = parseHHmm(s.endTime);
    return isMinuteInWindow(minutes, startMin, endMin);
  }

  /**
   * Returns pairs of schedule ids that overlap on the same screen scope (same day, time intersection).
   */
  findOverlappingPairs(
    schedules: Array<{
      id: string;
      screenId: string | null;
      daysOfWeek: number[];
      startTime: string;
      endTime: string;
      priority: number;
    }>,
  ): Array<[string, string]> {
    const overlaps: Array<[string, string]> = [];
    const list = [...schedules];

    const window = (start: string, end: string) => {
      const a = parseHHmm(start);
      const b = parseHHmm(end);
      return { a, b, crosses: a >= b };
    };

    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const x = list[i];
        const y = list[j];
        if (x.screenId !== y.screenId) continue;
        const days = x.daysOfWeek.filter((d) => y.daysOfWeek.includes(d));
        if (days.length === 0) continue;

        const wx = window(x.startTime, x.endTime);
        const wy = window(y.startTime, y.endTime);

        const intersects = this.windowsOverlap(wx, wy);
        if (intersects) overlaps.push([x.id, y.id]);
      }
    }
    return overlaps;
  }

  private windowsOverlap(
    x: { a: number; b: number; crosses: boolean },
    y: { a: number; b: number; crosses: boolean },
  ): boolean {
    const inWin = (m: number, w: { a: number; b: number; crosses: boolean }) =>
      w.crosses ? m >= w.a || m < w.b : m >= w.a && m < w.b;

    for (let m = 0; m < 24 * 60; m += 15) {
      if (inWin(m, x) && inWin(m, y)) return true;
    }
    return false;
  }
}
