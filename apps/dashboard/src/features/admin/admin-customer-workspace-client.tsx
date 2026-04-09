'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Route } from 'next';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ArrowLeft, Building2, Monitor, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AdminCosmicLoader } from '@/components/admin/admin-cosmic-loader';
import { apiFetch, readApiErrorMessage, setStoredAccessToken } from '@/features/auth/session';
import { useWorkspace } from '@/features/workspace/workspace-context';
import { adminGlassTable } from '@/lib/admin-glass-table';
import { cn } from '@/lib/utils';

type ScreenStatus = 'ONLINE' | 'OFFLINE' | 'MAINTENANCE';

type WorkspacePayload = {
  customerId: string;
  workspace: {
    id: string;
    name: string;
    slug: string;
    createdAt: string;
  };
  screens: Array<{
    id: string;
    name: string;
    serialNumber: string;
    status: ScreenStatus;
    location: string | null;
    lastSeenAt: string | null;
    createdAt: string;
  }>;
};

type Props = {
  customerId: string;
  workspaceId: string;
};

export function AdminCustomerWorkspaceClient({ customerId, workspaceId }: Props) {
  const locale = useLocale();
  const t = useTranslations('adminCustomerWorkspace');
  const tProfile = useTranslations('adminCustomerProfile');
  const { refreshWorkspaces } = useWorkspace();
  const [data, setData] = useState<WorkspacePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [impersonating, setImpersonating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch(`/admin/customers/${customerId}/workspaces/${workspaceId}`);
    if (!res.ok) {
      const detail = await readApiErrorMessage(res).catch(() => '');
      toast.error(detail || t('loadFailed'));
      setData(null);
      setLoading(false);
      return;
    }
    const json = (await res.json()) as WorkspacePayload;
    setData(json);
    setLoading(false);
  }, [customerId, workspaceId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const impersonate = async () => {
    if (!data) return;
    setImpersonating(true);
    try {
      const res = await apiFetch(`/admin/users/${data.customerId}/impersonate`, {
        method: 'POST',
        body: JSON.stringify({ workspaceId: data.workspace.id }),
      });
      if (!res.ok) {
        toast.error(tProfile('toastImpersonateFailed'));
        return;
      }
      const payload = (await res.json()) as {
        accessToken?: string;
        workspaces?: Array<{ id: string }>;
      };
      if (payload.accessToken) {
        setStoredAccessToken(payload.accessToken);
      }
      const first = payload.workspaces?.[0]?.id ?? data.workspace.id;
      await refreshWorkspaces(first);
      toast.success(tProfile('toastEnteringWs'));
      window.location.assign(`/${locale}/media` as Route);
    } finally {
      setImpersonating(false);
    }
  };

  function statusLabel(s: ScreenStatus): string {
    if (s === 'ONLINE') return t('screenStatus.ONLINE');
    if (s === 'OFFLINE') return t('screenStatus.OFFLINE');
    return t('screenStatus.MAINTENANCE');
  }

  if (loading) {
    return <AdminCosmicLoader label={t('loading')} />;
  }

  if (!data) {
    return (
      <div className="rounded-3xl border border-[#FF6B00]/15 bg-muted/20 p-8 text-center">
        <p className="text-sm text-muted-foreground">{t('loadFailed')}</p>
        <Button
          type="button"
          variant="outline"
          className="mt-4 rounded-2xl border-[#FF6B00]/30"
          asChild
        >
          <Link href={`/${locale}/admin/customers/${customerId}` as Route}>
            {tProfile('backToHub')}
          </Link>
        </Button>
      </div>
    );
  }

  const { workspace, screens } = data;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Link
          href={`/${locale}/admin/customers/${customerId}` as Route}
          className="inline-flex items-center gap-2 text-sm font-medium text-[#94A3B8] transition hover:text-[#FF6B00]"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToProfile')}
        </Link>
        <Button
          type="button"
          variant="outline"
          className="rounded-2xl border-[#FF6B00]/35 bg-[#FF6B00]/5 hover:bg-[#FF6B00]/10"
          disabled={impersonating}
          onClick={() => void impersonate()}
        >
          <Send className="me-2 h-4 w-4" />
          {t('openWorkspace')}
        </Button>
      </div>

      <section className="relative overflow-hidden rounded-3xl border border-[#FF6B00]/20 bg-gradient-to-br from-[#1a1208] via-card to-[#0f0a14] p-4 shadow-[0_0_60px_-20px_rgba(255, 107, 0,0.35)] sm:p-6 md:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#FF6B00]/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#94A3B8]">
              {t('kicker')}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Building2 className="h-6 w-6 text-[#FF6B00]" />
              <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {workspace.name}
              </h1>
            </div>
            <p className="font-mono text-xs text-muted-foreground">
              {t('slugLabel')}: {workspace.slug}
            </p>
            <p className="text-sm text-muted-foreground">
              {t('createdLabel')}:{' '}
              {new Date(workspace.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' })}
            </p>
          </div>
          <div className="grid min-w-[180px] gap-2 rounded-2xl border border-[#FF6B00]/15 bg-black/20 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#94A3B8]">
              {tProfile('screens')}
            </p>
            <div className="flex items-center gap-2">
              <Monitor className="h-5 w-5 text-[#FF6B00]" />
              <span className="font-mono text-2xl font-semibold tabular-nums text-foreground">
                {screens.length}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{t('screensTitle')}</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{t('screensHint')}</p>
        </div>
        <div className={cn(adminGlassTable.wrap, 'shadow-[0_0_40px_-12px_rgba(255, 107, 0,0.25)]')}>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className={adminGlassTable.theadRow}>
                  <TableHead className={cn(adminGlassTable.th, 'text-start')}>{t('colName')}</TableHead>
                  <TableHead className={cn(adminGlassTable.th, 'text-start')}>{t('colSerial')}</TableHead>
                  <TableHead className={cn(adminGlassTable.th, 'text-start')}>{t('colStatus')}</TableHead>
                  <TableHead className={cn(adminGlassTable.th, 'text-start')}>{t('colLocation')}</TableHead>
                  <TableHead className={cn(adminGlassTable.th, 'text-start')}>{t('colLastSeen')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {screens.map((row) => (
                  <TableRow key={row.id} className={adminGlassTable.tbodyRow}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{row.serialNumber}</TableCell>
                    <TableCell className="text-sm">{statusLabel(row.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.location ?? '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.lastSeenAt
                        ? new Date(row.lastSeenAt).toLocaleString(undefined, {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {screens.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">{t('noScreens')}</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
