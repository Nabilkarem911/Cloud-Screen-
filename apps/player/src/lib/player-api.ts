import type { BootstrapResponse } from '@/types/player-playlist';
import { getApiBaseUrl } from '@/lib/auth-session';

export type StartPairingSessionResponse = {
  sessionId: string;
  pairingCode: string;
  pollSecret: string;
  expiresAt: string;
};

export type PollPairingSessionResponse =
  | { status: 'pending'; expiresAt: string }
  | {
      status: 'complete';
      screenId?: string | null;
      workspaceId?: string | null;
      serialNumber: string;
    }
  | { status: 'expired'; expiresAt: string }
  | { status: 'cancelled'; expiresAt: string };

export type WorkspaceBootstrapResponse = {
  screenId: string;
  serialNumber: string;
  workspaceId: string;
  workspaceName?: string | null;
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

export async function startPlayerPairingSession(body?: {
  playerPlatform?: 'ANDROID' | 'TIZEN' | 'WEBOS' | 'WEB';
  resolutionWidth?: number;
  resolutionHeight?: number;
  /** When set with `NEXT_PUBLIC_PLAYER_HEARTBEAT_SECRET`, notifies this workspace (`pairing:started`). */
  workspaceId?: string;
}): Promise<StartPairingSessionResponse> {
  const secret = process.env.NEXT_PUBLIC_PLAYER_HEARTBEAT_SECRET?.trim();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret) headers['x-player-secret'] = secret;
  const res = await fetch(`${getApiBaseUrl()}/player/pairing/sessions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body ?? {}),
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Pairing start failed (${res.status})`);
  }
  return res.json() as Promise<StartPairingSessionResponse>;
}

export async function pollPlayerPairingSession(
  sessionId: string,
  pollSecret: string,
): Promise<PollPairingSessionResponse> {
  const url = new URL(
    `${getApiBaseUrl()}/player/pairing/sessions/${encodeURIComponent(sessionId)}`,
  );
  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'x-pairing-poll-secret': pollSecret,
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Pairing poll failed (${res.status})`);
  }
  return res.json() as Promise<PollPairingSessionResponse>;
}
