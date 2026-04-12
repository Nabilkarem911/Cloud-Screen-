'use client';

import { useEffect, useMemo, useState } from 'react';
import { isPrimarilyArabicScript } from '@/lib/ticker-direction';

type Props = {
  tickerText: string | null;
};

function formatClock(d: Date) {
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function PlayerHud({ tickerText }: Props) {
  const [now, setNow] = useState(() => new Date());
  const [online, setOnline] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine,
  );

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    setOnline(navigator.onLine);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const displayTicker = tickerText?.trim() || '';
  const rtlTicker = useMemo(
    () => isPrimarilyArabicScript(displayTicker),
    [displayTicker],
  );

  return (
    <>
      <div className="pointer-events-none fixed right-4 top-4 z-[500] flex items-center gap-3 rounded-xl border border-cyan-500/20 bg-black/55 px-3.5 py-2.5 shadow-[0_0_32px_rgba(0,212,255,0.18),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md">
        <span
          className="relative flex h-3 w-3 shrink-0"
          title={online ? 'Network online' : 'Offline — cached playback'}
          aria-label={online ? 'Online' : 'Offline'}
        >
          <span
            className={`absolute inset-0 animate-pulse rounded-full blur-[8px] ${
              online ? 'bg-emerald-400' : 'bg-red-500'
            }`}
          />
          <span
            className={`relative inline-flex h-3 w-3 rounded-full ring-2 ring-white/10 ${
              online
                ? 'bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,1)]'
                : 'bg-red-500 shadow-[0_0_16px_rgba(248,113,113,0.95)]'
            }`}
          />
        </span>
        <time
          dateTime={now.toISOString()}
          className="text-base tabular-nums tracking-wide text-white drop-shadow-[0_0_12px_rgba(0,212,255,0.35)]"
        >
          {formatClock(now)}
        </time>
      </div>

      {displayTicker ? (
        <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-[480] overflow-hidden border-t border-cyan-500/15 bg-gradient-to-t from-black/90 via-black/60 to-transparent py-2.5">
          <div
            className={`eclipse-marquee flex whitespace-nowrap text-sm text-cyan-100/95 font-sans [font-feature-settings:normal]${rtlTicker ? ' eclipse-marquee-rtl' : ''}`}
            dir={rtlTicker ? 'rtl' : 'ltr'}
            lang={rtlTicker ? 'ar' : undefined}
          >
            <span className="inline-block min-w-full shrink-0 px-6">
              {displayTicker}
              <span className="mx-16 text-white/35">◆</span>
              {displayTicker}
            </span>
            <span className="inline-block min-w-full shrink-0 px-6" aria-hidden>
              {displayTicker}
              <span className="mx-16 text-white/35">◆</span>
              {displayTicker}
            </span>
          </div>
        </div>
      ) : null}
    </>
  );
}
