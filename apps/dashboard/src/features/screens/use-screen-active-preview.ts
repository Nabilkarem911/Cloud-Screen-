'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/features/auth/session';

type Item = {
  kind?: string;
  media?: { publicUrl?: string; mimeType?: string };
};

export function useScreenActivePreview(
  screenId: string | null,
  workspaceId: string | null,
) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!screenId || !workspaceId) {
      setPreviewUrl(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const res = await apiFetch(
        `/screens/${screenId}/active-content?workspaceId=${encodeURIComponent(workspaceId)}`,
        { method: 'GET' },
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
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [screenId, workspaceId]);

  return { previewUrl, loading };
}
