'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/features/auth/session';
import { useWorkspace } from '@/features/workspace/workspace-context';

type Item = {
  kind?: string;
  media?: { publicUrl?: string; mimeType?: string };
};

/**
 * Loads the first media URL from the screen's active playlist for card thumbnails.
 * Refetches when `workspaceDataEpoch` bumps (mutations across the app) so previews
 * stay in sync after playlist / screen / media changes without a full page reload.
 */
export function useScreenActivePreview(
  screenId: string | null,
  workspaceId: string | null,
) {
  const { workspaceDataEpoch } = useWorkspace();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewRev, setPreviewRev] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!screenId || !workspaceId) {
      setPreviewUrl(null);
      setPreviewRev(0);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const res = await apiFetch(
        `/screens/${screenId}/active-content?workspaceId=${encodeURIComponent(workspaceId)}`,
        { method: 'GET', cache: 'no-store' },
      );
      if (!res.ok || cancelled) {
        if (!cancelled) setLoading(false);
        return;
      }
      const data = (await res.json()) as {
        playlist?: { items?: Item[] } | null;
      };
      const items = data?.playlist?.items ?? [];
      const firstMedia = items.find(
        (i) => i.kind === 'media' && i.media?.publicUrl,
      );
      const url = firstMedia?.media?.publicUrl ?? null;
      if (!cancelled) {
        setPreviewUrl(url);
        setPreviewRev((n) => n + 1);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [screenId, workspaceId, workspaceDataEpoch]);

  return { previewUrl, loading, previewRev };
}
