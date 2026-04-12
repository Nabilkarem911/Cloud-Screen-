'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  clearPersistedKioskSerial,
  getPersistedKioskSerial,
  getPlayerBearerToken,
} from '@/lib/auth-session';
import {
  clearOfflinePlaylistSnapshot,
  loadOfflinePlaylistSnapshot,
  saveOfflinePlaylistSnapshot,
} from '@/lib/offline-playlist-cache';
import { fetchPlayerBootstrap, fetchWorkspaceBootstrap } from '@/lib/player-api';
import {
  clearPlayerMediaCache,
  invalidateResolvedBlobUrls,
  warmMediaUrls,
} from '@/lib/media-cache';
import { devWarn } from '@/lib/dev-log';
import { collectMediaUrls, parsePlaylistPayload } from '@/lib/playlist-utils';
import type { PlaylistPayload } from '@/types/player-playlist';
import { IdentifyOverlay } from '@/components/identify-overlay';
import { LoadingOverlay } from '@/components/loading-overlay';
import { PlayerHud } from '@/components/player-hud';
import { PlayerContentPlaceholder } from '@/components/player-content-placeholder';
import { PlayerPairingWait } from '@/components/player-pairing-wait';
import {
  PlaylistEngine,
  type PlaylistPlaybackErrorPayload,
} from '@/components/playlist-engine';

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

type BootMode = 'pending' | 'jwt' | 'kiosk' | 'pairing' | 'none';

export function PlayerRuntime() {
  const envSerial = useMemo(
    () => process.env.NEXT_PUBLIC_PLAYER_SCREEN_SERIAL?.trim() ?? '',
    [],
  );
  const [kioskSerial, setKioskSerial] = useState(envSerial);
  const [storageReady, setStorageReady] = useState(false);
  const secret = process.env.NEXT_PUBLIC_PLAYER_HEARTBEAT_SECRET?.trim();
  const workspaceNameOpt = process.env.NEXT_PUBLIC_PLAYER_WORKSPACE_NAME?.trim();

  useLayoutEffect(() => {
    if (!envSerial) {
      const s = getPersistedKioskSerial();
      if (s) setKioskSerial(s);
    }
    setStorageReady(true);
  }, [envSerial]);

  const [bootMode, setBootMode] = useState<BootMode>('pending');
  const [playlist, setPlaylist] = useState<PlaylistPayload | null>(null);
  const [ticker, setTicker] = useState<string | null>(null);
  const [displaySerial, setDisplaySerial] = useState<string>('');
  const [identifyOpen, setIdentifyOpen] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [connectionHint, setConnectionHint] = useState<string | null>(null);
  const [liveCanvasLayouts, setLiveCanvasLayouts] = useState<Record<string, unknown>>({});
  const [workspaceDisplayName, setWorkspaceDisplayName] = useState<string | null>(null);

  const identifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serialForIdentifyRef = useRef('');
  serialForIdentifyRef.current = displaySerial || kioskSerial || '';
  const displaySerialRef = useRef('');
  displaySerialRef.current = displaySerial;
  const kioskSerialRef = useRef('');
  kioskSerialRef.current = kioskSerial;
  const bootModeRef = useRef<BootMode>('pending');
  bootModeRef.current = bootMode;
  const tickerRef = useRef<string | null>(null);
  tickerRef.current = ticker;
  const workspaceNameRef = useRef<string | null>(null);
  workspaceNameRef.current = workspaceDisplayName;
  /** True while showing last cached playlist after bootstrap API failure. */
  const offlinePlaybackActiveRef = useRef(false);
  const kioskSocketRef = useRef<Socket | null>(null);
  const playlistRef = useRef<PlaylistPayload | null>(null);

  useEffect(() => {
    playlistRef.current = playlist;
  }, [playlist]);

  const reportPlaybackMediaError = useCallback(
    (payload: PlaylistPlaybackErrorPayload) => {
      kioskSocketRef.current?.emit('screen:error', {
        code: payload.code,
        medium: payload.medium,
        mediaId: payload.mediaId,
        detail: payload.detail,
      });
    },
    [],
  );

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
    void (async () => {
      try {
        await warmMediaUrls(urls);
      } catch (e) {
        devWarn('[player-runtime] warmMediaUrls failed (continuing with playlist)', e);
      }
      setLiveCanvasLayouts({});
      setPlaylist(next);
      const serial = displaySerialRef.current || kioskSerialRef.current;
      if (serial) {
        saveOfflinePlaylistSnapshot({
          mode: bootModeRef.current === 'jwt' ? 'jwt' : 'kiosk',
          serialNumber: serial,
          workspaceId: next.workspaceId,
          screenId: next.screenId,
          workspaceName: workspaceNameRef.current,
          ticker: tickerRef.current,
          playlist: next,
        });
      }
    })();
  }, []);

  const runBootstrap = useCallback(async () => {
    if (!kioskSerial || !secret) return;
    setBootstrapError(null);
    offlinePlaybackActiveRef.current = false;
    try {
      const data = await fetchPlayerBootstrap(kioskSerial, secret);
      setDisplaySerial(data.serialNumber);
      setTicker(data.ticker);
      setWorkspaceDisplayName(data.workspaceName ?? null);
      setLiveCanvasLayouts({});
      const urls = collectMediaUrls(data.playlist);
      try {
        await warmMediaUrls(urls);
      } catch (e) {
        devWarn('[player-runtime] warmMediaUrls failed after bootstrap', e);
      }
      setPlaylist(data.playlist);
      saveOfflinePlaylistSnapshot({
        mode: 'kiosk',
        serialNumber: data.serialNumber,
        workspaceId: data.workspaceId,
        screenId: data.playlist.screenId,
        workspaceName: data.workspaceName ?? null,
        ticker: data.ticker ?? null,
        playlist: data.playlist,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Bootstrap failed';
      const snap = loadOfflinePlaylistSnapshot();
      if (
        snap &&
        snap.mode === 'kiosk' &&
        snap.serialNumber === kioskSerial &&
        snap.playlist
      ) {
        setBootstrapError(`${msg} — offline: showing last cached playlist`);
        try {
          await warmMediaUrls(collectMediaUrls(snap.playlist));
        } catch {
          /* cache-only playback */
        }
        setDisplaySerial(snap.serialNumber);
        setTicker(snap.ticker);
        setWorkspaceDisplayName(snap.workspaceName);
        setLiveCanvasLayouts({});
        setPlaylist(snap.playlist);
        offlinePlaybackActiveRef.current = true;
        return;
      }
      setBootstrapError(msg);
      throw e;
    }
  }, [kioskSerial, secret]);

  const runJwtBootstrap = useCallback(async () => {
    const token = getPlayerBearerToken();
    if (!token) return;
    setBootstrapError(null);
    offlinePlaybackActiveRef.current = false;
    try {
      const data = await fetchWorkspaceBootstrap(token, {
        workspaceName: workspaceNameOpt,
      });
      setDisplaySerial(data.serialNumber);
      setTicker(data.ticker);
      setWorkspaceDisplayName(data.workspaceName ?? null);
      setLiveCanvasLayouts({});
      const urls = collectMediaUrls(data.playlist);
      try {
        await warmMediaUrls(urls);
      } catch (e) {
        devWarn('[player-runtime] warmMediaUrls failed after workspace bootstrap', e);
      }
      setPlaylist(data.playlist);
      saveOfflinePlaylistSnapshot({
        mode: 'jwt',
        serialNumber: data.serialNumber,
        workspaceId: data.workspaceId,
        screenId: data.playlist.screenId,
        workspaceName: data.workspaceName ?? null,
        ticker: data.ticker ?? null,
        playlist: data.playlist,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Workspace bootstrap failed';
      const snap = loadOfflinePlaylistSnapshot();
      if (snap && snap.mode === 'jwt' && getPlayerBearerToken() && snap.playlist) {
        setBootstrapError(`${msg} — offline: showing last cached playlist`);
        try {
          await warmMediaUrls(collectMediaUrls(snap.playlist));
        } catch {
          /* cache-only playback */
        }
        setDisplaySerial(snap.serialNumber);
        setTicker(snap.ticker);
        setWorkspaceDisplayName(snap.workspaceName);
        setLiveCanvasLayouts({});
        setPlaylist(snap.playlist);
        offlinePlaybackActiveRef.current = true;
        return;
      }
      setBootstrapError(msg);
      throw e;
    }
  }, [workspaceNameOpt]);

  const runBootstrapRef = useRef(runBootstrap);
  runBootstrapRef.current = runBootstrap;
  const runJwtBootstrapRef = useRef(runJwtBootstrap);
  runJwtBootstrapRef.current = runJwtBootstrap;

  useEffect(() => {
    if (!storageReady) return;
    const token = getPlayerBearerToken();
    if (token) {
      setBootMode('jwt');
      void runJwtBootstrap().catch(() => {
        /* bootstrapError */
      });
      return;
    }
    if (secret && kioskSerial) {
      setBootMode('kiosk');
      void runBootstrap().catch(() => {
        /* bootstrapError */
      });
      return;
    }
    if (secret && !kioskSerial) {
      setBootMode('pairing');
      return;
    }
    setBootMode('none');
  }, [storageReady, runBootstrap, runJwtBootstrap, kioskSerial, secret]);

  useEffect(() => {
    if (bootMode !== 'jwt') return;
    const poll = setInterval(() => {
      void runJwtBootstrapRef.current().catch(() => {
        /* bootstrapError */
      });
    }, SCHEDULE_POLL_MS);
    return () => clearInterval(poll);
  }, [bootMode]);

  /** JWT player: join screen room for live `player:ticker` without full bootstrap reload. */
  useEffect(() => {
    if (bootMode !== 'jwt') return;
    const token = getPlayerBearerToken();
    const screenId = playlist?.screenId?.trim();
    if (!token || !screenId) return;

    const socket = io(`${getRealtimeBaseUrl()}/realtime`, {
      path: '/socket.io',
      transports: ['websocket'],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 20000,
      timeout: 20000,
    });
    const bind = () => {
      socket.emit('player:bind_screen', { screenId });
    };

    socket.on('connect', bind);

    socket.on('player:ticker', (payload: PlayerTickerPayload) => {
      const next = payload?.text ?? null;
      setTicker(next);
      const snap = playlistRef.current;
      const serial = displaySerialRef.current;
      if (snap && serial) {
        saveOfflinePlaylistSnapshot({
          mode: 'jwt',
          serialNumber: serial,
          workspaceId: snap.workspaceId,
          screenId: snap.screenId,
          workspaceName: workspaceNameRef.current,
          ticker: next,
          playlist: snap,
        });
      }
    });

    socket.on('disconnect', () => {
      /* keep UI; kiosk path sets hints */
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [bootMode, playlist?.screenId]);

  useEffect(() => {
    if (bootMode !== 'kiosk' || !kioskSerial || !secret) return;

    const socket = io(`${getRealtimeBaseUrl()}/realtime`, {
      path: '/socket.io',
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 20000,
      timeout: 20000,
    });
    kioskSocketRef.current = socket;

    const heartbeatPayload = () => ({
      isOfflineMode:
        (typeof navigator !== 'undefined' && !navigator.onLine) ||
        offlinePlaybackActiveRef.current,
    });

    const register = () => {
      socket.emit('screen:register', { serialNumber: kioskSerial, secret });
      socket.emit('screen:heartbeat', heartbeatPayload());
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

    const handleContentSync = async (raw: unknown) => {
      const parsed = parsePlaylistPayload(raw);
      if (parsed) {
        try {
          await warmMediaUrls(collectMediaUrls(parsed));
        } catch (e) {
          devWarn('[player-runtime] content:sync warmMediaUrls failed', e);
        }
        setLiveCanvasLayouts({});
        setPlaylist(parsed);
        const serial = displaySerialRef.current || kioskSerialRef.current;
        if (serial) {
          saveOfflinePlaylistSnapshot({
            mode: bootModeRef.current === 'jwt' ? 'jwt' : 'kiosk',
            serialNumber: serial,
            workspaceId: parsed.workspaceId,
            screenId: parsed.screenId,
            workspaceName: workspaceNameRef.current,
            ticker: tickerRef.current,
            playlist: parsed,
          });
        }
        return;
      }
      try {
        await runBootstrapRef.current();
      } catch {
        const again = parsePlaylistPayload(raw);
        if (again) {
          try {
            await warmMediaUrls(collectMediaUrls(again));
          } catch (err) {
            devWarn('[player-runtime] content:sync fallback warm failed', err);
          }
          setLiveCanvasLayouts({});
          setPlaylist(again);
        }
      }
    };

    socket.on('content:sync', (raw: unknown) => {
      void handleContentSync(raw);
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
      const next = payload?.text ?? null;
      setTicker(next);
      const snap = playlistRef.current;
      const serial = displaySerialRef.current || kioskSerialRef.current;
      if (snap && serial) {
        saveOfflinePlaylistSnapshot({
          mode: 'kiosk',
          serialNumber: serial,
          workspaceId: snap.workspaceId,
          screenId: snap.screenId,
          workspaceName: workspaceNameRef.current,
          ticker: next,
          playlist: snap,
        });
      }
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
      if (socket.connected) socket.emit('screen:heartbeat', heartbeatPayload());
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
      kioskSocketRef.current = null;
    };
  }, [applyPlaylistPayload, bootMode, secret, kioskSerial]);

  if (bootMode === 'pending') {
    return <LoadingOverlay label="Starting player…" />;
  }

  if (bootMode === 'pairing') {
    return (
      <div className="relative min-h-screen min-h-[100dvh] bg-[#030712]">
        <LoadingOverlay behind label="Waiting for pairing…" />
        <div className="relative z-10">
          <PlayerPairingWait />
        </div>
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
          <p className="mt-4 text-sm text-white/65">
            <strong className="text-white/85">Pairing (no serial yet):</strong> set only{' '}
            <code className="rounded bg-black/40 px-1 font-mono text-cyan-200/90">NEXT_PUBLIC_PLAYER_HEARTBEAT_SECRET</code> — the
            player shows a 6-digit code; claim it from the dashboard, then the serial is saved in this browser for kiosk mode.
          </p>
          <button
            type="button"
            className="mt-6 w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 font-mono text-xs text-white/70 hover:bg-white/[0.1]"
            onClick={() => {
              clearPersistedKioskSerial();
              clearOfflinePlaylistSnapshot();
              window.location.reload();
            }}
          >
            Clear saved kiosk serial (localStorage)
          </button>
        </div>
      </div>
    );
  }

  const showBootstrapSplash =
    (bootMode === 'jwt' || bootMode === 'kiosk') && !playlist && !bootstrapError;

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

      {!showBootstrapSplash ? <PlayerHud tickerText={ticker} /> : null}

      {showBootstrapSplash ? (
        <LoadingOverlay embedded label="Loading workspace…" />
      ) : null}

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
                onPlaybackMediaError={
                  bootMode === 'kiosk' ? reportPlaybackMediaError : undefined
                }
              />
            </motion.div>
          ) : (
            <motion.div
              key="placeholder"
              className="absolute inset-0 h-full w-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45 }}
            >
              <PlayerContentPlaceholder
                workspaceName={workspaceDisplayName}
                hasPlaylistSelected={Boolean(playlist?.playlistId)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {identifyOpen ? (
          <IdentifyOverlay key="identify" serialNumber={displaySerial || kioskSerial || ''} />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
