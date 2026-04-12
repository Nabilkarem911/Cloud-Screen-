'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CanvasKonvaView } from '@/components/canvas-konva-view';
import { resolvePlaybackUrl } from '@/lib/media-cache';
import { devWarn } from '@/lib/dev-log';
import type { PlaylistItemUnion } from '@/types/player-playlist';

const PLAYBACK_ERROR_SKIP_MS = 3000;
/** After this many consecutive slide failures, hard-reload to clear bad cache / memory state. */
const SKIP_STREAK_RELOAD_THRESHOLD = 5;

export type MediaObjectFitMode = 'cover' | 'contain';

const defaultMediaObjectFit: MediaObjectFitMode =
  process.env.NEXT_PUBLIC_PLAYER_MEDIA_OBJECT_FIT === 'contain'
    ? 'contain'
    : 'cover';

export type PlaylistPlaybackErrorPayload = {
  code: string;
  medium: 'video' | 'image';
  mediaId?: string;
  detail?: string;
};

type Props = {
  items: PlaylistItemUnion[];
  liveCanvasLayouts?: Record<string, unknown>;
  /** Kiosk realtime: report to server via `screen:error` after recoverable failures. */
  onPlaybackMediaError?: (payload: PlaylistPlaybackErrorPayload) => void;
  /**
   * Image / video fit. Defaults to `cover` (or `NEXT_PUBLIC_PLAYER_MEDIA_OBJECT_FIT=contain`).
   * Canvas stage always uses cover-style scaling.
   */
  mediaObjectFit?: MediaObjectFitMode;
};

function isVideoMime(mime: string) {
  return mime.startsWith('video/');
}

type MediaResolved = {
  kind: 'media';
  key: string;
  src: string;
  mimeType: string;
  mediaId: string;
};

type CanvasResolved = {
  kind: 'canvas';
  key: string;
  canvas: {
    id: string;
    width: number;
    height: number;
    layoutData: unknown;
  };
};

type ResolvedSlide = MediaResolved | CanvasResolved;

function MediaSlide({
  slide,
  onMediaFatalError,
  objectFit,
}: {
  slide: MediaResolved;
  onMediaFatalError: (medium: 'video' | 'image', detail?: string) => void;
  objectFit: MediaObjectFitMode;
}) {
  const video = isVideoMime(slide.mimeType);
  const firedRef = useRef(false);
  const fitClass = objectFit === 'cover' ? 'object-cover' : 'object-contain';
  const mediaBoxClass =
    objectFit === 'cover'
      ? 'h-full w-full min-h-full min-w-full'
      : 'max-h-full max-w-full';

  const fire = useCallback(
    (medium: 'video' | 'image', detail?: string) => {
      if (firedRef.current) return;
      firedRef.current = true;
      onMediaFatalError(medium, detail);
    },
    [onMediaFatalError],
  );

  return (
    <div
      className={`absolute inset-0 overflow-hidden bg-black${
        objectFit === 'contain' ? ' flex items-center justify-center' : ''
      }`}
    >
      {video ? (
        <video
          className={`${mediaBoxClass} ${fitClass}`}
          src={slide.src}
          muted
          playsInline
          autoPlay
          loop={false}
          preload="auto"
          onError={() => fire('video', 'video-error')}
          onAbort={() => fire('video', 'aborted')}
          ref={(el) => {
            if (!el) return;
            void el.play().catch(() => {
              /* autoplay policies — rely on onError for hard media failures */
            });
          }}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={slide.src}
          alt=""
          className={`${mediaBoxClass} ${fitClass}`}
          draggable={false}
          onError={() => fire('image', 'image-error')}
        />
      )}
    </div>
  );
}

function maybeReloadOnSkipStreak(streak: number): boolean {
  if (streak < SKIP_STREAK_RELOAD_THRESHOLD) return false;
  if (typeof window !== 'undefined') {
    window.location.reload();
  }
  return true;
}

export function PlaylistEngine({
  items,
  liveCanvasLayouts,
  onPlaybackMediaError,
  mediaObjectFit = defaultMediaObjectFit,
}: Props) {
  const sorted = useMemo(
    () => [...items].sort((a, b) => a.orderIndex - b.orderIndex),
    [items],
  );

  const playlistKey = useMemo(
    () =>
      sorted
        .map((i) =>
          i.kind === 'media' ? `m:${i.media.id}` : `c:${i.canvas.id}`,
        )
        .join('|'),
    [sorted],
  );

  const [cursor, setCursor] = useState(0);
  const [loopNonce, setLoopNonce] = useState(0);
  const [resolved, setResolved] = useState<ResolvedSlide | null>(null);
  const [allSlidesFailed, setAllSlidesFailed] = useState(false);
  const skipStreakRef = useRef(0);
  /** Browser timer id (`window.setTimeout`); avoid `NodeJS.Timeout` mismatch in Next worker types. */
  const errorSkipTimerRef = useRef<number | null>(null);

  const clearErrorSkipTimer = useCallback(() => {
    if (errorSkipTimerRef.current != null) {
      window.clearTimeout(errorSkipTimerRef.current);
      errorSkipTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    skipStreakRef.current = 0;
    setAllSlidesFailed(false);
    setCursor(0);
    setLoopNonce(0);
    setResolved(null);
    clearErrorSkipTimer();
  }, [playlistKey, clearErrorSkipTimer]);

  useEffect(() => {
    return () => clearErrorSkipTimer();
  }, [clearErrorSkipTimer]);

  const advanceAfterFailure = useCallback(() => {
    skipStreakRef.current += 1;
    if (maybeReloadOnSkipStreak(skipStreakRef.current)) {
      return;
    }
    if (skipStreakRef.current >= sorted.length) {
      setAllSlidesFailed(true);
      setResolved(null);
      return;
    }
    if (sorted.length === 1) {
      setLoopNonce((n) => n + 1);
    } else {
      setCursor((c) => (c + 1) % sorted.length);
    }
  }, [sorted.length]);

  const loadSlide = useCallback(
    async (item: PlaylistItemUnion, index: number, nonce: number): Promise<ResolvedSlide> => {
      if (item.kind === 'canvas') {
        return {
          kind: 'canvas',
          key: `${playlistKey}-${index}-${item.canvas.id}-${nonce}`,
          canvas: {
            id: item.canvas.id,
            width: item.canvas.width,
            height: item.canvas.height,
            layoutData: item.canvas.layoutData,
          },
        };
      }
      const src = await resolvePlaybackUrl(item.media.publicUrl);
      return {
        kind: 'media',
        key: `${playlistKey}-${index}-${item.media.id}-${nonce}`,
        src,
        mimeType: item.media.mimeType,
        mediaId: item.media.id,
      };
    },
    [playlistKey],
  );

  useEffect(() => {
    if (sorted.length === 0) {
      setResolved(null);
      setAllSlidesFailed(false);
      return;
    }
    const idx = cursor % sorted.length;

    let cancelled = false;
    void (async () => {
      try {
        const slide = await loadSlide(sorted[idx]!, idx, loopNonce);
        if (!cancelled) {
          setResolved(slide);
          skipStreakRef.current = 0;
          setAllSlidesFailed(false);
        }
      } catch (err) {
        devWarn('[PlaylistEngine] Asset unavailable, skipping slide', {
          index: idx,
          err,
        });
        if (cancelled) return;
        skipStreakRef.current += 1;
        if (maybeReloadOnSkipStreak(skipStreakRef.current)) {
          return;
        }
        if (skipStreakRef.current >= sorted.length) {
          setAllSlidesFailed(true);
          setResolved(null);
          return;
        }
        if (sorted.length === 1) {
          setLoopNonce((n) => n + 1);
        } else {
          setCursor((c) => (c + 1) % sorted.length);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cursor, sorted, loadSlide, loopNonce]);

  useEffect(() => {
    if (sorted.length < 2) return;
    const nextIdx = (cursor + 1) % sorted.length;
    const next = sorted[nextIdx];
    if (next?.kind === 'media') {
      void resolvePlaybackUrl(next.media.publicUrl).catch((err) => {
        devWarn('[PlaylistEngine] Prefetch failed for next slide', err);
      });
    }
  }, [cursor, sorted]);

  useEffect(() => {
    if (sorted.length === 0 || allSlidesFailed || !resolved) return;
    const item = sorted[cursor % sorted.length];
    if (!item) return;
    const ms = Math.max(500, (item.durationSec ?? 5) * 1000);
    const t = window.setTimeout(() => {
      if (sorted.length === 1) {
        setLoopNonce((n) => n + 1);
      } else {
        setCursor((c) => (c + 1) % sorted.length);
      }
    }, ms);
    return () => window.clearTimeout(t);
  }, [cursor, sorted, loopNonce, allSlidesFailed, resolved]);

  const handleMediaFatalError = useCallback(
    (medium: 'video' | 'image', detail?: string) => {
      clearErrorSkipTimer();
      const idx = cursor % sorted.length;
      const item = sorted[idx];
      const mediaId = item?.kind === 'media' ? item.media.id : undefined;
      onPlaybackMediaError?.({
        code: 'PLAYBACK_MEDIA_FAILED',
        medium,
        mediaId,
        detail,
      });
      const tid = window.setTimeout(() => {
        errorSkipTimerRef.current = null;
        advanceAfterFailure();
      }, PLAYBACK_ERROR_SKIP_MS);
      errorSkipTimerRef.current = tid as unknown as number;
    },
    [
      advanceAfterFailure,
      clearErrorSkipTimer,
      cursor,
      sorted,
      onPlaybackMediaError,
    ],
  );

  if (sorted.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-black">
        <p className="font-mono text-sm tracking-[0.2em] text-white/45">
          No playlist items assigned
        </p>
      </div>
    );
  }

  if (allSlidesFailed) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-black px-4 text-center">
        <p className="font-mono text-sm text-amber-200/90">No playable media</p>
        <p className="max-w-md font-mono text-xs text-white/40">
          Every item failed to load or cache. Check connectivity and asset URLs in the dashboard.
        </p>
      </div>
    );
  }

  if (!resolved) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-black">
        <p className="font-mono text-sm text-white/55">Loading media…</p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <AnimatePresence mode="sync" initial={false}>
        <motion.div
          key={resolved.key}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.65, ease: [0.4, 0, 0.2, 1] }}
        >
          {resolved.kind === 'media' ? (
            <MediaSlide
              slide={resolved}
              onMediaFatalError={handleMediaFatalError}
              objectFit={mediaObjectFit}
            />
          ) : (
            <CanvasKonvaView
              designWidth={resolved.canvas.width}
              designHeight={resolved.canvas.height}
              layoutData={resolved.canvas.layoutData}
              liveOverride={
                liveCanvasLayouts?.[resolved.canvas.id] ?? null
              }
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
