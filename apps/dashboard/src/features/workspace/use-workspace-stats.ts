'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { apiFetch } from '@/features/auth/session';

export type WorkspaceCounts = {
  media: number;
  screens: number;
  playlists: number;
};

export function useWorkspaceStats(
  workspaceId: string | null,
  dataEpoch: number,
): WorkspaceCounts {
  const pathname = usePathname();
  const [counts, setCounts] = useState<WorkspaceCounts>({
    media: 0,
    screens: 0,
    playlists: 0,
  });

  useEffect(() => {
    if (!workspaceId) {
      setCounts({ media: 0, screens: 0, playlists: 0 });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [mRes, sRes, pRes] = await Promise.all([
          apiFetch(`/media?workspaceId=${encodeURIComponent(workspaceId)}`),
          apiFetch(
            `/screens?workspaceId=${encodeURIComponent(workspaceId)}&page=1&limit=500`,
          ),
          apiFetch(`/playlists?workspaceId=${encodeURIComponent(workspaceId)}`),
        ]);
        const mediaJson = mRes.ok ? await mRes.json() : [];
        const screensJson = sRes.ok ? await sRes.json() : null;
        const playlistsJson = pRes.ok ? await pRes.json() : [];
        if (cancelled) return;
        const media = Array.isArray(mediaJson) ? mediaJson : [];
        const playlists = Array.isArray(playlistsJson) ? playlistsJson : [];
        const total =
          screensJson &&
          typeof screensJson === 'object' &&
          'total' in screensJson &&
          typeof (screensJson as { total: unknown }).total === 'number'
            ? (screensJson as { total: number }).total
            : 0;
        setCounts({
          media: media.length,
          screens: total,
          playlists: playlists.length,
        });
      } catch {
        if (!cancelled) setCounts({ media: 0, screens: 0, playlists: 0 });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, dataEpoch, pathname]);

  return counts;
}
