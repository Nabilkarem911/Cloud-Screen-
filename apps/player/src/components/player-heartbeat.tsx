'use client';

import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const HEARTBEAT_INTERVAL_MS = 30_000;

function getRealtimeBaseUrl(): string {
  return process.env.NEXT_PUBLIC_REALTIME_URL ?? 'http://localhost:4000';
}

type InnerProps = {
  serialNumber: string;
  secret: string;
};

function PlayerHeartbeatInner({ serialNumber, secret }: InnerProps) {
  const [status, setStatus] = useState<'connecting' | 'live' | 'error'>('connecting');
  const [detail, setDetail] = useState<string>('Connecting to realtime gateway…');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
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
      register();
    });

    socket.on('screen:registered', () => {
      setStatus('live');
      setDetail(`Heartbeat active for ${serialNumber}`);
    });

    socket.on('playlist:updated', (payload: unknown) => {
      console.log('[playlist:updated]', payload);
    });

    socket.on('screen:error', (payload: { code?: string }) => {
      setStatus('error');
      setDetail(payload?.code ?? 'Registration failed');
    });

    socket.on('disconnect', (reason) => {
      setDetail(`Disconnected (${reason}). Reconnecting…`);
    });

    socket.on('reconnect', () => {
      register();
    });

    socket.on('connect_error', (err) => {
      setStatus('error');
      setDetail(err.message);
    });

    intervalRef.current = setInterval(() => {
      if (socket.connected) {
        socket.emit('screen:heartbeat');
      }
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [serialNumber, secret]);

  return (
    <div className="mt-6 rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-white/80">
      <p className="text-xs uppercase tracking-[0.18em] text-white/50">Realtime</p>
      <p className="mt-2 font-medium text-white">
        Status:{' '}
        <span
          className={
            status === 'live'
              ? 'text-emerald-400'
              : status === 'error'
                ? 'text-red-400'
                : 'text-amber-300'
          }
        >
          {status}
        </span>
      </p>
      <p className="mt-1 text-xs text-white/60">{detail}</p>
    </div>
  );
}

export function PlayerHeartbeat() {
  const serialNumber = process.env.NEXT_PUBLIC_PLAYER_SCREEN_SERIAL?.trim();
  const secret = process.env.NEXT_PUBLIC_PLAYER_HEARTBEAT_SECRET?.trim();

  if (!serialNumber || !secret) {
    return (
      <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100/90">
        <p className="text-xs uppercase tracking-[0.18em] text-amber-200/70">Realtime</p>
        <p className="mt-2">
          Set <code className="rounded bg-black/40 px-1">NEXT_PUBLIC_PLAYER_SCREEN_SERIAL</code> and{' '}
          <code className="rounded bg-black/40 px-1">NEXT_PUBLIC_PLAYER_HEARTBEAT_SECRET</code> in the root{' '}
          <code className="rounded bg-black/40 px-1">.env</code> (secret must match backend{' '}
          <code className="rounded bg-black/40 px-1">PLAYER_HEARTBEAT_SECRET</code>).
        </p>
      </div>
    );
  }

  return <PlayerHeartbeatInner serialNumber={serialNumber} secret={secret} />;
}
