const ACCESS_TOKEN_STORAGE_KEY = 'cs_access_token';

export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';
}

/**
 * Bearer for player: env (dev) first, then localStorage on this origin (paste token).
 * Dashboard (3000) and player (3001) do not share localStorage — use env or paste on player.
 */
export function getPlayerBearerToken(): string | null {
  const fromEnv = process.env.NEXT_PUBLIC_PLAYER_ACCESS_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
}

export function setPlayerBearerToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
  else localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
}
