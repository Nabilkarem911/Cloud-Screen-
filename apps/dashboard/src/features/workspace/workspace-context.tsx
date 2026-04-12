'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { io } from 'socket.io-client';
import { apiFetch, getStoredAccessToken } from '@/features/auth/session';

export type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  isPaused?: boolean;
  role?: string;
};

type WorkspaceContextValue = {
  workspaceId: string | null;
  workspaces: WorkspaceSummary[];
  setWorkspaceId: (id: string) => void;
  refreshWorkspaces: (preferredWorkspaceId?: string | null) => Promise<void>;
  /** Increment after mutations so sidebar counts / dependents refetch. */
  workspaceDataEpoch: number;
  bumpWorkspaceDataEpoch: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  userEmail: string | null;
  userFullName: string | null;
  businessName: string | null;
  /** Super-admin session id when JWT was minted via impersonation. */
  impersonatedBySuperAdminId: string | null;
  /** Bumped when `pairing:started` is received on the workspace room (Add Screen flow). */
  pairingActivityEpoch: number;
  bumpPairingActivityEpoch: () => void;
};

const WORKSPACE_COOKIE_KEY = 'cs_workspace_id';
const SUPER_ADMIN_STORAGE_KEY = 'cs_super_admin';

function writeStoredSuperAdminHint(value: boolean | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (value === null) sessionStorage.removeItem(SUPER_ADMIN_STORAGE_KEY);
    else sessionStorage.setItem(SUPER_ADMIN_STORAGE_KEY, value ? '1' : '0');
  } catch {
    /* ignore */
  }
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const cookie = document.cookie
    .split('; ')
    .find((part) => part.startsWith(`${name}=`))
    ?.split('=')[1];
  return cookie ? decodeURIComponent(cookie) : null;
}

function setCookie(name: string, value: string): void {
  if (typeof document === 'undefined') return;
  const secure =
    typeof window !== 'undefined' && window.location.protocol === 'https:'
      ? '; Secure'
      : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${60 * 60 * 24 * 30}; Path=/; SameSite=Lax${secure}`;
}

function clearCookie(name: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspaceId, setWorkspaceIdState] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [workspaceDataEpoch, setWorkspaceDataEpoch] = useState(0);
  const [pairingActivityEpoch, setPairingActivityEpoch] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userFullName, setUserFullName] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [impersonatedBySuperAdminId, setImpersonatedBySuperAdminId] = useState<
    string | null
  >(null);
  const hasSuccessfulMeRef = useRef(false);

  const bumpWorkspaceDataEpoch = useCallback(() => {
    setWorkspaceDataEpoch((n) => n + 1);
  }, []);

  const bumpPairingActivityEpoch = useCallback(() => {
    setPairingActivityEpoch((n) => n + 1);
  }, []);

  const setWorkspaceId = useCallback((id: string) => {
    setWorkspaceIdState(id);
    setCookie(WORKSPACE_COOKIE_KEY, id);
  }, []);

  const resetToLoggedOut = useCallback(() => {
    hasSuccessfulMeRef.current = false;
    setIsAuthenticated(false);
    setIsSuperAdmin(false);
    writeStoredSuperAdminHint(null);
    setUserEmail(null);
    setUserFullName(null);
    setBusinessName(null);
    setImpersonatedBySuperAdminId(null);
    setWorkspaces([]);
    setWorkspaceIdState(null);
    clearCookie(WORKSPACE_COOKIE_KEY);
  }, []);

  const refreshWorkspaces = useCallback(async (preferredWorkspaceId?: string | null) => {
    setIsLoading(true);
    try {
      const response = await apiFetch('/auth/me', { method: 'GET' });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          resetToLoggedOut();
          return;
        }
        if (hasSuccessfulMeRef.current) {
          return;
        }
        resetToLoggedOut();
        return;
      }

      let raw: {
        email?: string;
        fullName?: string | null;
        businessName?: string | null;
        memberships?: Array<{ role: string; workspace: WorkspaceSummary }>;
        isSuperAdmin?: boolean;
        impersonatedBy?: string | null;
      };
      try {
        raw = (await response.json()) as typeof raw;
      } catch {
        if (hasSuccessfulMeRef.current) {
          return;
        }
        resetToLoggedOut();
        return;
      }

      setIsAuthenticated(true);
      const superAdmin = Boolean(raw.isSuperAdmin);
      setIsSuperAdmin(superAdmin);
      writeStoredSuperAdminHint(superAdmin);
      setUserEmail(typeof raw.email === 'string' ? raw.email : null);
      setUserFullName(
        raw.fullName != null && raw.fullName !== ''
          ? String(raw.fullName)
          : null,
      );
      setBusinessName(
        raw.businessName != null && raw.businessName !== ''
          ? String(raw.businessName)
          : null,
      );
      setImpersonatedBySuperAdminId(
        typeof raw.impersonatedBy === 'string' ? raw.impersonatedBy : null,
      );
      const list = Array.isArray(raw.memberships) ? raw.memberships : [];
      const mapped = list.map((membership) => ({
        ...membership.workspace,
        role: membership.role,
      }));
      setWorkspaces(mapped);
      hasSuccessfulMeRef.current = true;

      if (mapped.length === 0) {
        if (preferredWorkspaceId) {
          setWorkspaceIdState(preferredWorkspaceId);
          setCookie(WORKSPACE_COOKIE_KEY, preferredWorkspaceId);
        } else {
          setWorkspaceIdState(null);
          clearCookie(WORKSPACE_COOKIE_KEY);
        }
        return;
      }

      const preferredFromArg =
        preferredWorkspaceId &&
        mapped.some((item) => item.id === preferredWorkspaceId)
          ? preferredWorkspaceId
          : null;

      const existing = getCookie(WORKSPACE_COOKIE_KEY);
      const validExisting =
        existing && mapped.some((item) => item.id === existing) ? existing : null;

      let nextId: string | null = null;
      if (preferredFromArg) {
        nextId = preferredFromArg;
      } else if (mapped.length === 1) {
        nextId = mapped[0].id;
      } else {
        nextId = validExisting ?? mapped[0]?.id ?? null;
      }

      if (nextId) {
        setWorkspaceIdState(nextId);
        setCookie(WORKSPACE_COOKIE_KEY, nextId);
      }
    } catch {
      if (hasSuccessfulMeRef.current) {
        return;
      }
      resetToLoggedOut();
    } finally {
      setIsLoading(false);
    }
  }, [resetToLoggedOut]);

  useEffect(() => {
    const existing = getCookie(WORKSPACE_COOKIE_KEY);
    if (existing) setWorkspaceIdState(existing);
    void refreshWorkspaces();
  }, [refreshWorkspaces]);

  const value = useMemo(
    () => ({
      workspaceId,
      workspaces,
      setWorkspaceId,
      refreshWorkspaces,
      workspaceDataEpoch,
      bumpWorkspaceDataEpoch,
      isLoading,
      isAuthenticated,
      isSuperAdmin,
      userEmail,
      userFullName,
      businessName,
      impersonatedBySuperAdminId,
      pairingActivityEpoch,
      bumpPairingActivityEpoch,
    }),
    [
      workspaceId,
      workspaces,
      setWorkspaceId,
      refreshWorkspaces,
      workspaceDataEpoch,
      bumpWorkspaceDataEpoch,
      pairingActivityEpoch,
      bumpPairingActivityEpoch,
      isLoading,
      isAuthenticated,
      isSuperAdmin,
      userEmail,
      userFullName,
      businessName,
      impersonatedBySuperAdminId,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      <WorkspaceSubscriptionRealtimeBridge />
      {children}
    </WorkspaceContext.Provider>
  );
}

function getRealtimeBaseUrl(): string {
  return process.env.NEXT_PUBLIC_REALTIME_URL ?? 'http://localhost:4000';
}

/** Workspace Socket.IO: subscription updates + pairing activity for Add Screen UX. */
function WorkspaceSubscriptionRealtimeBridge() {
  const {
    workspaceId,
    bumpWorkspaceDataEpoch,
    bumpPairingActivityEpoch,
    isAuthenticated,
  } = useWorkspace();

  useEffect(() => {
    if (!isAuthenticated || !workspaceId) return;

    const token = getStoredAccessToken();
    const socket = io(`${getRealtimeBaseUrl()}/realtime`, {
      path: '/socket.io',
      withCredentials: true,
      auth: token ? { token } : undefined,
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 15000,
      timeout: 20000,
    });

    const onConnect = () => {
      socket.emit('dashboard:subscribe', { workspaceId });
    };

    socket.on('connect', onConnect);
    socket.on('workspace:subscription', () => {
      bumpWorkspaceDataEpoch();
    });
    socket.on('pairing:started', () => {
      bumpPairingActivityEpoch();
    });
    socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') socket.connect();
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [workspaceId, bumpWorkspaceDataEpoch, bumpPairingActivityEpoch, isAuthenticated]);

  return null;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return context;
}
