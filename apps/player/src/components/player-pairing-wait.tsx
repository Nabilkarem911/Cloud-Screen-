'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { setPersistedKioskSerial } from '@/lib/auth-session';
import {
  pollPlayerPairingSession,
  startPlayerPairingSession,
} from '@/lib/player-api';

const POLL_MS = 2000;

function getRealtimeBaseUrl(): string {
  return process.env.NEXT_PUBLIC_REALTIME_URL ?? 'http://localhost:4000';
}

type Phase = 'starting' | 'waiting' | 'error';

export function PlayerPairingWait() {
  const [phase, setPhase] = useState<Phase>('starting');
  const [error, setError] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState('');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const sessionRef = useRef<{ sessionId: string; pollSecret: string } | null>(null);
  const doneRef = useRef(false);

  const finish = useCallback((serial: string) => {
    if (doneRef.current) return;
    doneRef.current = true;
    setPersistedKioskSerial(serial);
    window.location.reload();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const hintWs = process.env.NEXT_PUBLIC_PAIRING_WORKSPACE_ID?.trim();
        const row = await startPlayerPairingSession({
          playerPlatform: 'WEB',
          ...(hintWs ? { workspaceId: hintWs } : {}),
        });
        if (cancelled) return;
        sessionRef.current = {
          sessionId: row.sessionId,
          pollSecret: row.pollSecret,
        };
        setPairingCode(row.pairingCode);
        setExpiresAt(row.expiresAt);
        setPhase('waiting');
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Pairing failed');
        setPhase('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (phase !== 'waiting' || !sessionRef.current) return;
    const { sessionId, pollSecret } = sessionRef.current;

    const runPoll = async () => {
      if (doneRef.current) return;
      try {
        const r = await pollPlayerPairingSession(sessionId, pollSecret);
        if (r.status === 'complete' && r.serialNumber) {
          finish(r.serialNumber);
          return;
        }
        if (r.status === 'expired' || r.status === 'cancelled') {
          setError('Pairing code expired. Refresh to try again.');
          setPhase('error');
        }
      } catch {
        /* keep polling */
      }
    };

    const pollTimer = setInterval(() => void runPoll(), POLL_MS);
    void runPoll();

    const socket: Socket = io(`${getRealtimeBaseUrl()}/realtime`, {
      path: '/socket.io',
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 50,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 20000,
      timeout: 20000,
    });

    const onConnect = () => {
      socket.emit('pairing:watch', { sessionId, pollSecret });
    };

    socket.on('connect', onConnect);
    if (socket.connected) onConnect();

    socket.on('pairing:complete', (payload: { serialNumber?: string }) => {
      if (payload?.serialNumber) finish(payload.serialNumber);
    });

    return () => {
      clearInterval(pollTimer);
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [phase, finish]);

  if (phase === 'starting') {
    return (
      <div className="grid min-h-screen place-items-center bg-[#030712] p-6">
        <p className="font-mono text-sm tracking-[0.2em] text-white/45">Preparing pairing…</p>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="grid min-h-screen place-items-center bg-[#030712] p-6">
        <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-white/[0.03] p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">Pairing</p>
          <p className="mt-3 font-mono text-sm text-red-200/90">{error ?? 'Unknown error'}</p>
          <button
            type="button"
            className="mt-6 w-full rounded-xl bg-[#FF6B00]/90 px-4 py-3 font-mono text-sm font-semibold text-amber-950"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[#030712] p-6">
      <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center shadow-[0_0_80px_rgba(255,107,0,0.12)]">
        <p className="text-xs uppercase tracking-[0.25em] text-white/45">Link this screen</p>
        <h1 className="mt-4 font-mono text-4xl font-bold tracking-[0.35em] text-white sm:text-5xl md:text-6xl">
          {pairingCode}
        </h1>
        <p className="mx-auto mt-8 max-w-lg text-sm leading-relaxed text-white/60">
          In the dashboard, open <strong className="text-white/80">Branch linking</strong> for your workspace and enter this{' '}
          <strong className="text-white/80">6-digit code</strong> under &quot;Link screen from player&quot;. This page updates
          automatically when the link succeeds.
        </p>
        {expiresAt ? (
          <p className="mt-4 font-mono text-xs text-white/35">
            Session expires: {new Date(expiresAt).toLocaleString()}
          </p>
        ) : null}
      </div>
    </div>
  );
}
