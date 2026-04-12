import { devWarn } from '@/lib/dev-log';

const CACHE_NAME = 'cloudsignage-player-v1';

/** Maps canonical media URL → object URL (deduped until cleared). */
const urlToBlob = new Map<string, string>();

function revokeAllBlobUrls(): void {
  for (const u of urlToBlob.values()) {
    try {
      URL.revokeObjectURL(u);
    } catch {
      // ignore
    }
  }
  urlToBlob.clear();
}

/**
 * Deletes the player Cache Storage bucket and revokes blob URLs created for playback.
 */
export async function clearPlayerMediaCache(): Promise<void> {
  revokeAllBlobUrls();
  try {
    await caches.delete(CACHE_NAME);
  } catch {
    // ignore
  }
}

/** Drop in-memory blob URLs without touching Cache Storage (e.g. after playlist refresh). */
export function invalidateResolvedBlobUrls(): void {
  revokeAllBlobUrls();
}

async function openCache(): Promise<Cache> {
  return caches.open(CACHE_NAME);
}

/**
 * Background prefetch: stores responses in Cache API for offline playback.
 */
export async function warmMediaUrls(urls: string[]): Promise<void> {
  const unique = [...new Set(urls.filter(Boolean))];
  const cache = await openCache();
  await Promise.all(
    unique.map(async (url) => {
      const hit = await cache.match(url);
      if (hit) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      try {
        const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
        if (res.ok) await cache.put(url, res.clone());
      } catch (err) {
        devWarn('[media-cache] Prefetch failed', url, err);
      }
    }),
  );
}

/**
 * Resolves a playable URL: prefers Cache when offline; fetches and caches when online.
 */
export async function resolvePlaybackUrl(mediaUrl: string): Promise<string> {
  const cached = urlToBlob.get(mediaUrl);
  if (cached) return cached;

  const cache = await openCache();
  let response = await cache.match(mediaUrl);

  if (!response && typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const res = await fetch(mediaUrl, { mode: 'cors', credentials: 'omit' });
      if (res.ok) {
        await cache.put(mediaUrl, res.clone());
        response = await cache.match(mediaUrl);
      }
    } catch {
      response = undefined;
    }
  }

  if (!response) {
    response = await cache.match(mediaUrl);
  }

  if (!response) {
    throw new Error('MEDIA_UNAVAILABLE');
  }

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  urlToBlob.set(mediaUrl, blobUrl);
  return blobUrl;
}
