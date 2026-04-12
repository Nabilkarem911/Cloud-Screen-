'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Monitor } from 'lucide-react';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AdminEmptyState } from '@/components/admin/admin-empty-state';
import { AdminCosmicLoader } from '@/components/admin/admin-cosmic-loader';
import { apiFetch } from '@/features/auth/session';
import type { ScreenStatus } from '@/features/screens/useApiScreens';
import { ScreenFleetStatusBadge } from '@/features/screens/screen-fleet-status';
import { adminGlassTable } from '@/lib/admin-glass-table';
import { cn } from '@/lib/utils';

const KNOWN_PLATFORMS = new Set(['WEB', 'ANDROID', 'TIZEN', 'WEBOS']);

function platformKey(p: string): 'WEB' | 'ANDROID' | 'TIZEN' | 'WEBOS' | 'UNKNOWN' {
  return KNOWN_PLATFORMS.has(p) ? (p as 'WEB' | 'ANDROID' | 'TIZEN' | 'WEBOS') : 'UNKNOWN';
}

export type GlobalAdminScreenRow = {
  id: string;
  name: string;
  serialNumber: string;
  status: ScreenStatus;
  lastSeenAt: string | null;
  playerPlatform: string;
  workspaceId: string;
  workspaceName: string;
  isOfflineCacheMode: boolean;
};

export function AdminScreensClient() {
  const locale = useLocale();
  const t = useTranslations('adminScreensClient');
  const [rows, setRows] = useState<GlobalAdminScreenRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await apiFetch('/admin/screens');
    if (!res.ok) {
      toast.error(t('loadFailed'));
      setLoading(false);
      return;
    }
    const data = (await res.json()) as GlobalAdminScreenRow[];
    setRows(data);
    setLoading(false);
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <AdminCosmicLoader label={t('loading')} />;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{t('hint')}</p>
      <div className={adminGlassTable.wrap}>
        {rows.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className={adminGlassTable.theadRow}>
                  <TableHead className={cn(adminGlassTable.th, 'text-start')}>
                    {t('workspace')}
                  </TableHead>
                  <TableHead className={cn(adminGlassTable.th, 'text-start')}>
                    {t('screen')}
                  </TableHead>
                  <TableHead className={cn(adminGlassTable.th, 'text-start font-mono text-[11px]')}>
                    {t('serial')}
                  </TableHead>
                  <TableHead className={cn(adminGlassTable.th, 'text-start')}>
                    {t('playerType')}
                  </TableHead>
                  <TableHead className={cn(adminGlassTable.th, 'text-start')}>
                    {t('connection')}
                  </TableHead>
                  <TableHead className={cn(adminGlassTable.th, 'text-start')}>
                    {t('offlineCache')}
                  </TableHead>
                  <TableHead className={cn(adminGlassTable.th, 'text-start')}>
                    {t('lastSeen')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => (
                  <TableRow key={s.id} className={adminGlassTable.tbodyRow}>
                    <TableCell>
                      <p className="font-medium">{s.workspaceName}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">{s.workspaceId}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF6B00]/12">
                          <Monitor className="h-4 w-4 text-[#94A3B8] dark:text-[#FF6B00]" />
                        </span>
                        <span className="font-medium">{s.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {s.serialNumber || '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {t(`platforms.${platformKey(s.playerPlatform)}`)}
                    </TableCell>
                    <TableCell>
                      <ScreenFleetStatusBadge
                        status={s.status}
                        lastSeenAt={s.lastSeenAt}
                        locale={locale}
                        tone="card"
                      />
                    </TableCell>
                    <TableCell className="text-sm">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em]',
                          s.isOfflineCacheMode
                            ? 'border border-amber-500/40 bg-amber-500/15 text-amber-950 dark:text-amber-100'
                            : 'border border-emerald-500/35 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100',
                        )}
                      >
                        {s.isOfflineCacheMode ? t('offlineYes') : t('offlineNo')}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {s.lastSeenAt
                        ? new Date(s.lastSeenAt).toLocaleString(locale, {
                            dateStyle: 'short',
                            timeStyle: 'medium',
                          })
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <AdminEmptyState icon={Monitor} title={t('empty')} description={t('emptyDescription')} />
        )}
      </div>
    </div>
  );
}
