'use client';

import { useEffect, useState } from 'react';
import type { Route } from 'next';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Building2 } from 'lucide-react';
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
import { adminGlassTable } from '@/lib/admin-glass-table';
import { cn } from '@/lib/utils';

type WorkspaceRow = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  ownerId: string | null;
  ownerCustomerProfileId: string | null;
  ownerEmail: string | null;
  ownerName: string | null;
  screenCount: number;
  mediaCount: number;
  storageBytes: number;
};

function formatBytes(n: number, locale: string): string {
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  if (n < 1024) return `${nf.format(n)} B`;
  if (n < 1024 * 1024) return `${nf.format(n / 1024)} KB`;
  if (n < 1024 * 1024 * 1024) return `${nf.format(n / (1024 * 1024))} MB`;
  return `${nf.format(n / (1024 * 1024 * 1024))} GB`;
}

export function AdminWorkspacesClient() {
  const locale = useLocale();
  const t = useTranslations('adminWorkspaces');
  const [rows, setRows] = useState<WorkspaceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await apiFetch('/admin/workspaces');
      if (!res.ok) {
        toast.error(t('loadFailed'));
        if (!cancelled) setLoading(false);
        return;
      }
      const data = (await res.json()) as WorkspaceRow[];
      if (!cancelled) {
        setRows(data);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  if (loading) {
    return <AdminCosmicLoader label={t('loading')} />;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{t('auditHint')}</p>
      <div className={adminGlassTable.wrap}>
        {rows.length > 0 ? (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className={adminGlassTable.theadRow}>
                <TableHead className={cn(adminGlassTable.th, 'text-start')}>{t('workspace')}</TableHead>
                <TableHead className={cn(adminGlassTable.th, 'text-start')}>{t('owner')}</TableHead>
                <TableHead className={cn(adminGlassTable.th, 'text-end tabular-nums')}>{t('screens')}</TableHead>
                <TableHead className={cn(adminGlassTable.th, 'text-end tabular-nums')}>{t('media')}</TableHead>
                <TableHead className={cn(adminGlassTable.th, 'text-end')}>{t('storage')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((w) => (
                <TableRow key={w.id} className={adminGlassTable.tbodyRow}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF6B00]/12">
                        <Building2 className="h-4 w-4 text-[#94A3B8] dark:text-[#FF6B00]" />
                      </span>
                      <div>
                        <p className="font-medium">{w.name}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">{w.slug}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {w.ownerCustomerProfileId ? (
                      <Link
                        href={`/${locale}/admin/customers/${w.ownerCustomerProfileId}` as Route}
                        className="block font-mono text-xs text-[#FF6B00] underline-offset-4 hover:underline"
                      >
                        {w.ownerEmail ?? t('na')}
                      </Link>
                    ) : (
                      <div className="font-mono text-xs">{w.ownerEmail ?? t('na')}</div>
                    )}
                    {w.ownerName ? (
                      <p className="text-[11px] text-muted-foreground">{w.ownerName}</p>
                    ) : null}
                    {!w.ownerCustomerProfileId && w.ownerId ? (
                      <p className="text-[10px] text-muted-foreground">{t('staffOwner')}</p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-end font-mono-nums text-sm tabular-nums">
                    {w.screenCount}
                  </TableCell>
                  <TableCell className="text-end font-mono-nums text-sm tabular-nums">
                    {w.mediaCount}
                  </TableCell>
                  <TableCell className="text-end font-mono text-sm tabular-nums text-muted-foreground">
                    {formatBytes(w.storageBytes, locale)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        ) : (
          <AdminEmptyState icon={Building2} title={t('empty')} description={t('emptyDescription')} />
        )}
      </div>
    </div>
  );
}
