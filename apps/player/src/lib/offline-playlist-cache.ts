import type { PlaylistPayload } from '@/types/player-playlist';

const STORAGE_KEY = 'cs_player_offline_snapshot_v1';

export type OfflinePlaylistSnapshot = {
  version: 1;
  mode: 'kiosk' | 'jwt';
  /** Screen serial (kiosk) or the serial returned with workspace bootstrap (JWT). */
  serialNumber: string;
  workspaceId: string;
  screenId: string;
  workspaceName: string | null;
  ticker: string | null;
  playlist: PlaylistPayload;
  savedAt: string;
};

function safeParse(raw: string | null): OfflinePlaylistSnapshot | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as OfflinePlaylistSnapshot;
    if (o?.version !== 1 || !o.serialNumber || !o.playlist || !Array.isArray(o.playlist.items)) {
      return null;
    }
    if (o.mode !== 'kiosk' && o.mode !== 'jwt') return null;
    return o;
  } catch {
    return null;
  }
}

export function loadOfflinePlaylistSnapshot(): OfflinePlaylistSnapshot | null {
  if (typeof window === 'undefined') return null;
  return safeParse(window.localStorage.getItem(STORAGE_KEY));
}

export function saveOfflinePlaylistSnapshot(
  snapshot: Omit<OfflinePlaylistSnapshot, 'version' | 'savedAt'>,
): void {
  if (typeof window === 'undefined') return;
  const full: OfflinePlaylistSnapshot = {
    version: 1,
    ...snapshot,
    savedAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(full));
  } catch {
    /* quota / private mode */
  }
}

export function clearOfflinePlaylistSnapshot(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
