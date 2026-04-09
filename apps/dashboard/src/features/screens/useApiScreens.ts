/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/features/auth/session';

export type ScreenStatus = 'ONLINE' | 'OFFLINE' | 'MAINTENANCE';

export type ScreenRow = {
  id: string;
  name: string;
  serialNumber: string;
  location?: string | null;
  status: ScreenStatus;
  playlistGroupId?: string | null;
  playlistGroup?: { id: string; name: string } | null;
  activePlaylistId: string | null;
  activePlaylist: { id: string; name: string } | null;
  updatedAt: string;
};

type ListResponse = {
  items: ScreenRow[];
};

type ScreensOptions = {
  playlistGroupId?: string;
};

export function useApiScreens(workspaceId: string | null, options?: ScreensOptions) {
  const playlistGroupId = options?.playlistGroupId;
  const [screens, setScreens] = useState<ScreenRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!workspaceId) {
      setScreens([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const params = new URLSearchParams({
      workspaceId,
      limit: '500',
      page: '1',
    });
    if (playlistGroupId) params.set('playlistGroupId', playlistGroupId);
    const response = await apiFetch(`/screens?${params.toString()}`, {
      method: 'GET',
    });

    if (response.ok) {
      const payload = (await response.json()) as ListResponse;
      setScreens(payload.items);
    } else {
      setScreens([]);
    }
    setIsLoading(false);
  }, [workspaceId, playlistGroupId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { screens, setScreens, isLoading, reload };
}
