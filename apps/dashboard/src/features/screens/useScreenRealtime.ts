'use client';

import type { Dispatch, SetStateAction } from 'react';
import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { getStoredAccessToken } from '@/features/auth/session';
import type { ScreenRow, ScreenStatus } from './useApiScreens';

type ScreenStatusPayload = {
  screenId: string;
  serialNumber: string;
  status: ScreenStatus;
  lastSeenAt: string;
};

function getRealtimeBaseUrl(): string {
  return process.env.NEXT_PUBLIC_REALTIME_URL ?? 'http://localhost:4000';
}

export function useScreenRealtime(
  workspaceId: string | null,
  setScreens: Dispatch<SetStateAction<ScreenRow[]>>,
): void {
  useEffect(() => {
    if (!workspaceId) return;

    const token = getStoredAccessToken();
    const socket: Socket = io(`${getRealtimeBaseUrl()}/realtime`, {
      path: '/socket.io',
      withCredentials: true,
      auth: token ? { token } : undefined,
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 15000,
      timeout: 20000,
    });

    socket.on('connect', () => {
      socket.emit('dashboard:subscribe', { workspaceId });
    });

    socket.on('screen:status', (payload: ScreenStatusPayload) => {
      setScreens((prev) =>
        prev.map((screen) =>
          screen.id === payload.screenId
            ? {
                ...screen,
                status: payload.status,
                updatedAt: payload.lastSeenAt,
              }
            : screen,
        ),
      );
    });

    socket.on('dashboard:error', () => {
      toast.error('Realtime connection rejected. Try signing in again.');
    });

    socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        socket.connect();
      }
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [workspaceId, setScreens]);
}
