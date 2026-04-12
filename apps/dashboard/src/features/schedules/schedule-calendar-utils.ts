/** Parse "HH:mm" to minutes from midnight. */
export function parseHHmm(s: string): number {
  const [h, m] = s.split(':').map((x) => parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

/** Minutes to "HH:mm". */
export function formatHHmm(minutes: number): string {
  const m = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

const DAY_MIN = 24 * 60;

/**
 * Visual segments for one schedule in one weekday column (0=Sun … 6=Sat).
 */
export function segmentsForColumn(
  daysOfWeek: number[],
  startTime: string,
  endTime: string,
  colDow: number,
): Array<{ startMin: number; endMin: number }> {
  if (!daysOfWeek.includes(colDow)) return [];
  const sm = parseHHmm(startTime);
  const em = parseHHmm(endTime);
  if (sm === em) return [];
  if (sm < em) {
    return [{ startMin: sm, endMin: em }];
  }
  return [
    { startMin: sm, endMin: DAY_MIN },
    { startMin: 0, endMin: em },
  ];
}

export function heightPxForSegment(
  startMin: number,
  endMin: number,
  pxPerHour: number,
): number {
  return ((endMin - startMin) / 60) * pxPerHour;
}

export function topPxForMinute(minute: number, pxPerHour: number): number {
  return (minute / 60) * pxPerHour;
}

/** Shift HH:mm window by delta minutes; same-day only (no overnight). */
export function shiftSameDayWindow(
  startTime: string,
  endTime: string,
  deltaMin: number,
): { startTime: string; endTime: string } | null {
  const sm = parseHHmm(startTime);
  const em = parseHHmm(endTime);
  if (sm >= em) return null;
  const ns = sm + deltaMin;
  const ne = em + deltaMin;
  if (ns < 0 || ne > DAY_MIN || ns >= ne) return null;
  return { startTime: formatHHmm(ns), endTime: formatHHmm(ne) };
}
