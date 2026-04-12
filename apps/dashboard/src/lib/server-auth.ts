import { cookies } from 'next/headers';

/** Server-side fetch (Docker): use service hostname; browser still uses NEXT_PUBLIC_*. */
const API_BASE =
  process.env.INTERNAL_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  'http://localhost:4000/api/v1';

export type AuthMeServer = {
  authenticated: boolean;
  isSuperAdmin: boolean;
};

/** Server-side session probe using httpOnly cookies (RSC / layouts). */
export async function fetchAuthMeServer(): Promise<AuthMeServer> {
  try {
    const jar = await cookies();
    const parts = jar.getAll().map((c) => `${c.name}=${c.value}`);
    if (parts.length === 0) {
      return { authenticated: false, isSuperAdmin: false };
    }
    const res = await fetch(`${API_BASE}/auth/me`, {
      method: 'GET',
      headers: { Cookie: parts.join('; ') },
      cache: 'no-store',
    });
    if (!res.ok) {
      return { authenticated: false, isSuperAdmin: false };
    }
    const body = (await res.json()) as { isSuperAdmin?: boolean };
    return {
      authenticated: true,
      isSuperAdmin: body.isSuperAdmin === true,
    };
  } catch {
    return { authenticated: false, isSuperAdmin: false };
  }
}
