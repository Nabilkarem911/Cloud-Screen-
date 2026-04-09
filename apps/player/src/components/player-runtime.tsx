'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { getPlayerBearerToken } from '@/lib/auth-session';
import { fetchPlayerBootstrap, fetchWorkspaceBootstrap } from '@/lib/player-api';
import {
  clearPlayerMediaCache,
  invalidateResolvedBlobUrls,
  warmMediaUrls,
} from '@/lib/media-cache';
import { collectMediaUrls, parsePlaylistPayload } from '@/lib/playlist-utils';
import type { PlaylistPayload } from '@/types/player-playlist';
import { IdentifyOverlay } from '@/components/identify-overlay';
import { PlayerHud } from '@/components/player-hud';
import { PlaylistEngine } from '@/components/playlist-engine';

const HEARTBEAT_INTERVAL_MS = 30_000;
const SCHEDULE_POLL_MS = 60_000;

function getRealtimeBaseUrl(): string {
  return process.env.NEXT_PUBLIC_REALTIME_URL ?? 'http://localhost:4000';
}

type RemoteCommandPayload = {
  command?: string;
  serialNumber?: string;
  screenId?: string;
};

type PlayerTickerPayload = {
  text?: string | null;
};

type BootMode = 'pending' | 'jwt' | 'kiosk' | 'none';

export function PlayerRuntime() {
  const serialNumber = process.env.NEXT_PUBLIC_PLAYER_SCREEN_SERIAL?.trim();
  const secret = process.env.NEXT_PUBLIC_PLAYER_HEARTBEAT_SECRET?.trim();
  const workspaceNameOpt = process.env.NEXT_PUBLIC_PLAYER_WORKSPACE_NAME?.trim();

  const [bootMode, setBootMode] = useState<BootMode>('pending');
  const [playlist, setPlaylist] = useState<PlaylistPayload | null>(null);
  const [ticker, setTicker] = useState<string | null>(null);
  const [displaySerial, setDisplaySerial] = useState<string>('');
  const [identifyOpen, setIdentifyOpen] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [connectionHint, setConnectionHint] = useState<string | null>(null);
  const [liveCanvasLayouts, setLiveCanvasLayouts] = useState<Record<string, unknown>>({});

  const identifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serialForIdentifyRef = useRef(serialNumber ?? '');
  serialForIdentifyRef.current = displaySerial || serialNumber || '';

  const playlistFingerprint = useMemo(() => {
    if (!playlist?.items?.length) return 'empty';
    return `${playlist.playlistId ?? 'null'}-${playlist.activeSource ?? 'default'}-${playlist.items
      .map((i) => (i.kind === 'media' ? `m:${i.media.id}` : `c:${i.canvas.id}`))
      .join(',')}`;
  }, [playlist]);

  const applyPlaylistPayload = useCallback((raw: unknown) => {
    const next = parsePlaylistPayload(raw);
    if (!next) return;
    const urls = collectMediaUrls(next);
    void warmMediaUrls(urls);
    setLiveCanvasLayouts({});
    setPlaylist(next);
  }, []);

  const runBootstrap = useCallback(async () => {
    if (!serialNumber || !secret) return;
    setBootstrapError(null);
    try {
      const data = await fetchPlayerBootstrap(serialNumber, secret);
      setDisplaySerial(data.serialNumber);
      setTicker(data.ticker);
      setPlaylist(data.playlist);
      setLiveCanvasLayouts({});
      const urls = collectMediaUrls(data.playlist);
      void warmMediaUrls(urls);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Bootstrap failed';
      setBootstrapError(msg);
      throw e;
    }
  }, [serialNumber, secret]);

  const runJwtBootstrap = useCallback(async () => {
    const token = getPlayerBearerToken();
    if (!token) return;
    setBootstrapError(null);
    try {
      const data = await fetchWorkspaceBootstrap(token, {
        workspaceName: workspaceNameOpt,
      });
      setDisplaySerial(data.serialNumber);
      setTicker(data.ticker);
      setPlaylist(data.playlist);
      setLiveCanvasLayouts({});
      const urls = collectMediaUrls(data.playlist);
      void warmMediaUrls(urls);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Workspace bootstrap failed';
      setBootstrapError(msg);
      throw e;
    }
  }, [workspaceNameOpt]);

  const runBootstrapRef = useRef(runBootstrap);
  runBootstrapRef.current = runBootstrap;
  const runJwtBootstrapRef = useRef(runJwtBootstrap);
  runJwtBootstrapRef.current = runJwtBootstrap;

  useEffect(() => {
    const token = getPlayerBearerToken();
    if (token) {
      setBootMode('jwt');
      void runJwtBootstrap().catch(() => {
        /* bootstrapError */
      });
      return;
    }
    if (serialNumber && secret) {
      setBootMode('kiosk');
      void runBootstrap().catch(() => {
        /* bootstrapError */
      });
      return;
    }
    setBootMode('none');
  }, [runBootstrap, runJwtBootstrap, serialNumber, secret]);

  useEffect(() => {
    if (bootMode !== 'jwt') return;
    const poll = setInterval(() => {
      void runJwtBootstrapRef.current().catch(() => {
        /* bootstrapError */
      });
    }, SCHEDULE_POLL_MS);
    return () => clearInterval(poll);
  }, [bootMode]);

  useEffect(() => {
    if (bootMode !== 'kiosk' || !serialNumber || !secret) return;

    const socket = io(`${getRealtimeBaseUrl()}/realtime`, {
      path: '/socket.io',
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 20000,
      timeout: 20000,
    });

    const register = () => {
      socket.emit('screen:register', { serialNumber, secret });
      socket.emit('screen:heartbeat');
    };

    socket.on('connect', () => {
      setConnectionHint(null);
      register();
    });

    socket.on('screen:registered', (payload: { ticker?: string | null }) => {
      if (payload && 'ticker' in payload && payload.ticker !== undefined) {
        setTicker(payload.ticker ?? null);
      }
    });

    socket.on('playlist:updated', (raw: unknown) => {
      applyPlaylistPayload(raw);
    });

    socket.on('content:sync', (raw: unknown) => {
      applyPlaylistPayload(raw);
    });

    socket.on('schedule:changed', (payload: unknown) => {
      if (
        payload &&
        typeof payload === 'object' &&
        'playlist' in payload &&
        (payload as { playlist?: unknown }).playlist !== undefined
      ) {
        applyPlaylistPayload((payload as { playlist: unknown }).playlist);
      } else {
        void runBootstrapRef.current().catch(() => {
          /* surfaced elsewhere */
        });
      }
    });

    socket.on(
      'canvas:live',
      (payload: { canvasId?: string; layoutData?: unknown }) => {
        if (payload?.canvasId && payload.layoutData !== undefined) {
          setLiveCanvasLayouts((prev) => ({
            ...prev,
            [payload.canvasId as string]: payload.layoutData,
          }));
        }
      },
    );

    socket.on('player:ticker', (payload: PlayerTickerPayload) => {
      setTicker(payload?.text ?? null);
    });

    socket.on('remote:command', (payload: RemoteCommandPayload) => {
      const cmd = payload?.command;
      if (cmd === 'identify') {
        const sn = payload.serialNumber ?? serialForIdentifyRef.current;
        if (identifyTimerRef.current) clearTimeout(identifyTimerRef.current);
        setDisplaySerial(sn);
        setIdentifyOpen(true);
        identifyTimerRef.current = setTimeout(() => {
          setIdentifyOpen(false);
          identifyTimerRef.current = null;
        }, 5000);
      } else if (cmd === 'refresh_content') {
        void (async () => {
          await clearPlayerMediaCache();
          invalidateResolvedBlobUrls();
          try {
            await runBootstrapRef.current();
          } catch {
            /* runBootstrap sets error state */
          }
        })();
      } else if (cmd === 'restart') {
        window.location.reload();
      }
    });

    socket.on('screen:error', (payload: { code?: string }) => {
      setConnectionHint(payload?.code ?? 'Registration error');
    });

    socket.on('disconnect', (reason: string) => {
      setConnectionHint(`Disconnected (${reason})`);
    });

    socket.on('reconnect', () => {
      register();
    });

    socket.on('connect_error', (err: Error) => {
      setConnectionHint(err.message);
    });

    const interval = setInterval(() => {
      if (socket.connected) socket.emit('screen:heartbeat');
    }, HEARTBEAT_INTERVAL_MS);

    const poll = setInterval(() => {
      void runBootstrapRef.current().catch(() => {
        /* bootstrapError */
      });
    }, SCHEDULE_POLL_MS);

    return () => {
      clearInterval(poll);
      clearInterval(interval);
      if (identifyTimerRef.current) clearTimeout(identifyTimerRef.current);
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [applyPlaylistPayload, bootMode, secret, serialNumber]);

  if (bootMode === 'pending') {
    return (
      <div className="grid min-h-screen place-items-center bg-[#030712] p-6">
        <p className="font-mono text-sm tracking-[0.2em] text-white/45">Starting player…</p>
      </div>
    );
  }

  if (bootMode === 'none') {
    return (
      <div className="grid min-h-screen place-items-center bg-[#030712] p-6">
        <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-white/[0.03] p-8 shadow-[0_0_60px_rgba(0,212,255,0.08)]">
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">Cloud Signage Player</p>
          <h1 className="mt-3 font-mono text-xl text-white/90">Configure environment</h1>
          <p className="mt-4 text-sm text-white/65">
            <strong className="text-white/85">JWT (Admin Control playlist):</strong> set{' '}
            <code className="rounded bg-black/40 px-1 font-mono text-cyan-200/90">
              NEXT_PUBLIC_PLAYER_ACCESS_TOKEN
            </code>{' '}
            in <code className="rounded bg-black/40 px-1">apps/player/.env.local</code> to the dashboard access token (sign in as
            admin, copy from Application → Local Storage <code className="rounded bg-black/40 px-1">cs_access_token</code>), or
            paste the token into the same key on this origin (localhost:3001).
          </p>
          <p className="mt-4 text-sm text-white/65">
            <strong className="text-white/85">Kiosk:</strong> set{' '}
            <code className="rounded bg-black/40 px-1 font-mono text-cyan-200/90">NEXT_PUBLIC_PLAYER_SCREEN_SERIAL</code> and{' '}
            <code className="rounded bg-black/40 px-1 font-mono text-cyan-200/90">NEXT_PUBLIC_PLAYER_HEARTBEAT_SECRET</code> (must
            match backend <code className="rounded bg-black/40 px-1">PLAYER_HEARTBEAT_SECRET</code>).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen min-h-[100dvh] w-screen overflow-hidden bg-black">
      {bootstrapError ? (
        <div className="absolute inset-x-0 top-0 z-[160] border-b border-red-500/30 bg-red-950/80 px-4 py-2 text-center font-mono text-sm text-red-100">
          {bootstrapError}
        </div>
      ) : null}
      {connectionHint ? (
        <div className="absolute inset-x-0 top-0 z-[155] border-b border-amber-500/25 bg-amber-950/70 px-4 py-1.5 text-center font-mono text-xs text-amber-100/90">
          {connectionHint}
        </div>
      ) : null}

      <PlayerHud tickerText={ticker} />

      <div className="relative h-full w-full pt-0">
        <AnimatePresence mode="wait">
          {playlist?.items?.length ? (
            <motion.div
              key={playlistFingerprint}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
            >
              <PlaylistEngine
                items={playlist.items}
                liveCanvasLayouts={liveCanvasLayouts}
              />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              className="absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-3 bg-[#030712]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45 }}
            >
              <p className="font-mono text-sm tracking-[0.25em] text-white/45">No media assigned</p>
              <p className="max-w-md text-center font-mono text-xs text-white/35">
                Assign a playlist to this screen in the dashboard. Media is cached locally for offline playback when the network is
                unavailable.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {identifyOpen ? (
          <IdentifyOverlay key="identify" serialNumber={displaySerial || serialNumber || ''} />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
