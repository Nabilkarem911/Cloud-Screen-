'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CanvasKonvaView } from '@/components/canvas-konva-view';
import { resolvePlaybackUrl } from '@/lib/media-cache';
import type { PlaylistItemUnion } from '@/types/player-playlist';

type Props = {
  items: PlaylistItemUnion[];
  liveCanvasLayouts?: Record<string, unknown>;
};

function isVideoMime(mime: string) {
  return mime.startsWith('video/');
}

type MediaResolved = {
  kind: 'media';
  key: string;
  src: string;
  mimeType: string;
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

function MediaSlide({ slide }: { slide: MediaResolved }) {
  const video = isVideoMime(slide.mimeType);

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black">
      {video ? (
        <video
          className="max-h-full max-w-full object-contain"
          src={slide.src}
          muted
          playsInline
          autoPlay
          loop={false}
          preload="auto"
          ref={(el) => {
            if (!el) return;
            void el.play().catch(() => {
              /* autoplay policies */
            });
          }}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={slide.src}
          alt=""
          className="max-h-full max-w-full object-contain"
          draggable={false}
        />
      )}
    </div>
  );
}

export function PlaylistEngine({ items, liveCanvasLayouts }: Props) {
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
      };
    },
    [playlistKey],
  );

  useEffect(() => {
    if (sorted.length === 0) {
      setResolved(null);
      return;
    }
    const idx = cursor % sorted.length;

    let cancelled = false;
    void (async () => {
      try {
        const slide = await loadSlide(sorted[idx], idx, loopNonce);
        if (!cancelled) setResolved(slide);
      } catch {
        if (!cancelled) setResolved(null);
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
    if (next.kind === 'media') {
      void resolvePlaybackUrl(next.media.publicUrl).catch(() => {
        /* preload */
      });
    }
  }, [cursor, sorted]);

  useEffect(() => {
    if (sorted.length === 0) return;
    const item = sorted[cursor % sorted.length];
    const ms = Math.max(500, (item.durationSec ?? 5) * 1000);
    const t = window.setTimeout(() => {
      if (sorted.length === 1) {
        setLoopNonce((n) => n + 1);
      } else {
        setCursor((c) => (c + 1) % sorted.length);
      }
    }, ms);
    return () => window.clearTimeout(t);
  }, [cursor, sorted, loopNonce]);

  if (sorted.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-black">
        <p className="font-mono text-sm tracking-[0.2em] text-white/45">
          No playlist items assigned
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
            <MediaSlide slide={resolved} />
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
