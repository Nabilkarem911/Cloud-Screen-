export function getApiBaseUrl() {
  const raw =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';
  return raw.replace(/\/+$/, '');
}

/** NestJS / validation errors: `{ message: string | string[] }` or plain text body */
export async function readApiErrorMessage(response: Response): Promise<string> {
  const text = await response.text();
  if (!text?.trim()) {
    return response.statusText || `HTTP ${response.status}`;
  }
  try {
    const j = JSON.parse(text) as {
      message?: unknown;
      error?: string;
    };
    if (Array.isArray(j.message)) {
      return j.message.map(String).join(', ');
    }
    if (typeof j.message === 'string') return j.message;
    if (typeof j.error === 'string') return j.error;
  } catch {
    /* use raw text */
  }
  return text.length > 800 ? `${text.slice(0, 800)}…` : text;
}

export type ApiFetchInit = RequestInit & { omitAuth?: boolean };

const ACCESS_TOKEN_STORAGE_KEY = 'cs_access_token';
/** Non-HttpOnly mirror so other same-site apps can read the JWT if needed (dev). */
const ACCESS_TOKEN_COOKIE_NAME = 'cs_access_mirror';
const PENDING_WORKSPACE_CREATE_KEY = 'cs_pending_workspace_create';

function setAccessTokenMirrorCookie(token: string | null): void {
  if (typeof document === 'undefined') return;
  const secure =
    typeof window !== 'undefined' && window.location.protocol === 'https:'
      ? '; Secure'
      : '';
  if (!token) {
    document.cookie = `${ACCESS_TOKEN_COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax${secure}`;
    return;
  }
  document.cookie = `${ACCESS_TOKEN_COOKIE_NAME}=${encodeURIComponent(token)}; Max-Age=${60 * 60 * 12}; Path=/; SameSite=Lax${secure}`;
}

let cachedCsrfToken: string | null = null;

/** Persist access JWT for cross-origin API calls (Authorization header). */
export function setStoredAccessToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
  else localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  setAccessTokenMirrorCookie(token);
}

export function getStoredAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
}

export function markPendingWorkspaceCreate(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PENDING_WORKSPACE_CREATE_KEY, '1');
}

export function consumePendingWorkspaceCreate(): boolean {
  if (typeof window === 'undefined') return false;
  const v = localStorage.getItem(PENDING_WORKSPACE_CREATE_KEY);
  if (v) localStorage.removeItem(PENDING_WORKSPACE_CREATE_KEY);
  return v === '1';
}

async function ensureCsrfToken(): Promise<string | null> {
  if (cachedCsrfToken) return cachedCsrfToken;
  const response = await fetch(`${getApiBaseUrl()}/csrf`, {
    method: 'GET',
    credentials: 'include',
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { csrfToken: string };
  cachedCsrfToken = data.csrfToken;
  return cachedCsrfToken;
}

function methodNeedsCsrf(method: string): boolean {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
}

function pathExemptFromCsrf(path: string): boolean {
  return (
    path.startsWith('/auth/login') ||
    path.startsWith('/auth/register/start') ||
    path.startsWith('/auth/register/verify') ||
    path.startsWith('/auth/forgot-password') ||
    path.startsWith('/auth/reset-password') ||
    path.startsWith('/auth/refresh') ||
    path.startsWith('/auth/dev-login')
  );
}

function shouldAttachBearer(): boolean {
  return Boolean(getStoredAccessToken());
}

export async function apiFetch(
  path: string,
  init: ApiFetchInit = {},
  retry = true,
): Promise<Response> {
  const { omitAuth, ...fetchInit } = init;
  const method = fetchInit.method?.toUpperCase() ?? 'GET';
  const isFormData =
    typeof FormData !== 'undefined' && fetchInit.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(fetchInit.headers as Record<string, string> | undefined),
  };
  if (
    !isFormData &&
    fetchInit.body !== undefined &&
    !headers['Content-Type']
  ) {
    headers['Content-Type'] = 'application/json';
  }

  const bearer = omitAuth ? null : getStoredAccessToken();
  if (bearer && !headers.Authorization) {
    headers.Authorization = `Bearer ${bearer}`;
  }

  if (
    methodNeedsCsrf(method) &&
    !pathExemptFromCsrf(path) &&
    !omitAuth &&
    !shouldAttachBearer()
  ) {
    const token = await ensureCsrfToken();
    if (token) {
      headers['X-CSRF-Token'] = token;
    }
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...fetchInit,
    credentials: 'include',
    headers,
  });

  if (
    response.status === 403 &&
    retry &&
    methodNeedsCsrf(method) &&
    !pathExemptFromCsrf(path)
  ) {
    cachedCsrfToken = null;
    const refreshed = await ensureCsrfToken();
    if (refreshed) {
      return apiFetch(path, init, false);
    }
  }

  if (response.status === 401 && retry) {
    const refreshResponse = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (refreshResponse.ok) {
      try {
        const body = (await refreshResponse.json()) as { accessToken?: string };
        if (body.accessToken) {
          setStoredAccessToken(body.accessToken);
        }
      } catch {
        /* ignore */
      }
      return apiFetch(path, init, false);
    }

    setStoredAccessToken(null);
    cachedCsrfToken = null;

    if (typeof window !== 'undefined') {
      const pathOnly = window.location.pathname;
      if (!pathOnly.includes('/login')) {
        if (method === 'POST' && path === '/workspaces') {
          markPendingWorkspaceCreate();
        }
        const segments = pathOnly.split('/').filter(Boolean);
        const localeFromPath = segments[0];
        const localeFromHtml = document.documentElement.lang;
        const locale =
          localeFromPath === 'ar' || localeFromPath === 'en'
            ? localeFromPath
            : localeFromHtml === 'ar' || localeFromHtml === 'en'
              ? localeFromHtml
              : 'en';
        const returnTo = encodeURIComponent(
          window.location.pathname + window.location.search,
        );
        window.location.assign(`/${locale}/login?returnTo=${returnTo}`);
      }
    }
  }

  return response;
}
