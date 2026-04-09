import type { BootstrapResponse } from '@/types/player-playlist';
import { getApiBaseUrl } from '@/lib/auth-session';

export type WorkspaceBootstrapResponse = {
  screenId: string;
  serialNumber: string;
  workspaceId: string;
  ticker: string | null;
  playlist: BootstrapResponse['playlist'];
};

export async function fetchPlayerBootstrap(
  serialNumber: string,
  secret: string,
): Promise<BootstrapResponse> {
  const url = new URL(`${getApiBaseUrl()}/player/bootstrap`);
  url.searchParams.set('serialNumber', serialNumber);
  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'x-player-secret': secret,
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Bootstrap failed (${res.status})`);
  }
  return res.json() as Promise<BootstrapResponse>;
}

/** JWT: first screen in workspace (default workspace name Admin Control). */
export async function fetchWorkspaceBootstrap(
  accessToken: string,
  opts?: { workspaceId?: string; workspaceName?: string },
): Promise<WorkspaceBootstrapResponse> {
  const url = new URL(`${getApiBaseUrl()}/player/workspace-bootstrap`);
  if (opts?.workspaceId?.trim()) {
    url.searchParams.set('workspaceId', opts.workspaceId.trim());
  }
  if (opts?.workspaceName?.trim()) {
    url.searchParams.set('workspaceName', opts.workspaceName.trim());
  }
  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: 'include',
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Workspace bootstrap failed (${res.status})`);
  }
  return res.json() as Promise<WorkspaceBootstrapResponse>;
}
