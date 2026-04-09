'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  MoreHorizontal,
  UserMinus,
  Send,
  ArrowUpRight,
  UserRoundCog,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { apiFetch, setStoredAccessToken } from '@/features/auth/session';
import { useWorkspace } from '@/features/workspace/workspace-context';
import { adminGlassTable } from '@/lib/admin-glass-table';
import { cn } from '@/lib/utils';

type PlatformRole =
  | 'SUPER_ADMIN'
  | 'SUPPORT_SPECIALIST'
  | 'BILLING_MANAGER'
  | 'ADMIN'
  | 'USER';

type CustomerLifecycle = 'active' | 'expired' | 'suspended' | 'trial';

type UserRow = {
  id: string;
  email: string;
  fullName: string;
  businessName?: string | null;
  isActive: boolean;
  isSuperAdmin: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  storageBytes: number;
  totalWorkspaces: number;
  platformRole: PlatformRole;
  subscriptionStatus: string;
  subscriptionEndDate: string | null;
  customerLifecycle: CustomerLifecycle;
  isIdle: boolean;
  expiredOrIdle: boolean;
};

type CustomerFilter = 'all' | 'active' | 'expired' | 'trial';

function formatBytes(n: number, locale: string): string {
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  if (n < 1024) return `${nf.format(n)} B`;
  if (n < 1024 * 1024) return `${nf.format(n / 1024)} KB`;
  if (n < 1024 * 1024 * 1024) return `${nf.format(n / (1024 * 1024))} MB`;
  return `${nf.format(n / (1024 * 1024 * 1024))} GB`;
}

function statusLabelClass(locale: string) {
  return locale === 'ar' ? 'normal-case' : 'uppercase tracking-wide';
}

/** Display Status column: Active | Expired | Suspended (trial rolls into Active with hint). */
function statusPill(
  lifecycle: CustomerLifecycle,
  t: ReturnType<typeof useTranslations<'adminCustomersHub'>>,
  locale: string,
) {
  const lab = statusLabelClass(locale);
  if (lifecycle === 'suspended') {
    return (
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-full border border-red-500/35 bg-red-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-red-200',
          lab,
        )}
      >
        {t('status.suspended')}
      </span>
    );
  }
  if (lifecycle === 'expired') {
    return (
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/12 px-2.5 py-0.5 text-[11px] font-semibold text-amber-100',
          lab,
        )}
      >
        {t('status.expired')}
      </span>
    );
  }
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-100',
        lab,
      )}
    >
      {t('status.active')}
      {lifecycle === 'trial' ? (
        <span className="ms-1 text-[10px] font-normal text-[#FF6B00]/90">· {t('status.trial')}</span>
      ) : null}
    </span>
  );
}

function formatSubscriptionStatus(
  status: string,
  t: ReturnType<typeof useTranslations<'adminCustomersHub'>>,
): string {
  if (status === 'TRIAL') return t('subscriptionPlan.TRIAL');
  if (status === 'ACTIVE') return t('subscriptionPlan.ACTIVE');
  if (status === 'EXPIRED') return t('subscriptionPlan.EXPIRED');
  return status;
}

export function AdminCustomersClient() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('adminCustomersHub');
  const tImpersonation = useTranslations('impersonation');
  const { refreshWorkspaces } = useWorkspace();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [meId, setMeId] = useState<string | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<UserRow | null>(null);
  const [impersonateTarget, setImpersonateTarget] = useState<UserRow | null>(null);
  const [filter, setFilter] = useState<CustomerFilter>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [reminderTarget, setReminderTarget] = useState<UserRow | null>(null);
  const [sendingReminder, setSendingReminder] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(id);
  }, [search]);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (filter !== 'all') params.set('filter', filter);
    const q = debouncedSearch.trim();
    if (q) params.set('q', q);
    const qs = params.toString();
    const [meRes, listRes] = await Promise.all([
      apiFetch('/auth/me'),
      apiFetch(`/admin/customers${qs ? `?${qs}` : ''}`),
    ]);
    if (meRes.ok) {
      const me = (await meRes.json()) as { id: string };
      setMeId(me.id);
    }
    if (!listRes.ok) {
      toast.error(t('loadFailed'));
      setLoading(false);
      return;
    }
    const data = (await listRes.json()) as UserRow[];
    setRows(data);
    setLoading(false);
  }, [filter, debouncedSearch, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const confirmSuspend = async () => {
    if (!suspendTarget) return;
    const res = await apiFetch(`/admin/users/${suspendTarget.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: false }),
    });
    setSuspendTarget(null);
    if (!res.ok) {
      toast.error(t('suspendFailed'));
      return;
    }
    toast.success(t('suspended'));
    await load();
  };

  const confirmImpersonate = async () => {
    if (!impersonateTarget) return;
    const target = impersonateTarget;
    setImpersonateTarget(null);
    const res = await apiFetch(`/admin/users/${target.id}/impersonate`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      toast.error(t('impersonateFailed'));
      return;
    }
    const payload = (await res.json()) as {
      accessToken?: string;
      workspaces?: Array<{ id: string; name: string; slug: string; role: string }>;
    };
    if (payload.accessToken) {
      setStoredAccessToken(payload.accessToken);
    }
    const firstWs = payload.workspaces?.[0]?.id;
    await refreshWorkspaces(firstWs ?? null);
    toast.success(t('openingAs', { email: target.email }));
    window.location.assign(`/${locale}/media` as Route);
  };

  const confirmSendReminder = async () => {
    if (!reminderTarget) return;
    setSendingReminder(true);
    try {
      const res = await apiFetch(`/admin/customers/${reminderTarget.id}/reminder`, {
        method: 'POST',
      });
      setReminderTarget(null);
      if (!res.ok) throw new Error('fail');
      const body = (await res.json()) as { message?: string };
      toast.success(body.message ?? t('reminderSent'));
    } catch {
      toast.error(t('reminderFailed'));
    } finally {
      setSendingReminder(false);
    }
  };

  const openProfile = (id: string) => {
    router.push(`/${locale}/admin/customers/${id}` as Route);
  };

  if (loading) {
    return <AdminCosmicLoader label={t('loading')} />;
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex min-w-[200px] flex-1 items-center gap-2">
          <Label htmlFor="customer-filter" className="sr-only">
            {t('table.statusFilterLabel')}
          </Label>
          <select
            id="customer-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value as CustomerFilter)}
            className={cn(
              'h-10 flex-1 rounded-2xl border border-[#FF6B00]/25 bg-background px-3 text-sm font-medium',
              'ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]/40',
            )}
          >
            <option value="all">{t('filters.all')}</option>
            <option value="active">{t('filters.active')}</option>
            <option value="expired">{t('filters.expired')}</option>
            <option value="trial">{t('filters.trial')}</option>
          </select>
        </div>
        <div className="min-w-[220px] flex-1 sm:max-w-md">
          <Label htmlFor="customer-search" className="sr-only">
            {t('table.searchLabel')}
          </Label>
          <Input
            id="customer-search"
            type="search"
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-2xl border-[#FF6B00]/20"
          />
        </div>
      </div>



      <div className={adminGlassTable.wrap}>

        {rows.length > 0 ? (
        <div className="overflow-x-auto">

          <Table>

            <TableHeader>

              <TableRow className={adminGlassTable.theadRow}>

                <TableHead className={cn(adminGlassTable.th, 'text-start')}>{t('table.columns.customer')}</TableHead>

                <TableHead className={cn(adminGlassTable.th, 'text-center')}>{t('table.columns.status')}</TableHead>

                <TableHead className={cn(adminGlassTable.th, 'text-end')}>{t('table.columns.workspaces')}</TableHead>

                <TableHead className={cn(adminGlassTable.th, 'text-center')}>{t('table.columns.planType')}</TableHead>

                <TableHead className={cn(adminGlassTable.th, 'text-start')}>{t('table.columns.expiryDate')}</TableHead>

                <TableHead className={cn(adminGlassTable.th, 'w-[72px] text-end')}>{t('table.columns.actions')}</TableHead>

              </TableRow>

            </TableHeader>

            <TableBody>

              {rows.map((u) => (

                <TableRow

                  key={u.id}

                  className={cn(

                    adminGlassTable.tbodyRowClickable,

                    !u.isActive && 'opacity-60',

                  )}

                  onClick={() => openProfile(u.id)}

                >

                  <TableCell className="font-medium">

                    <Link

                      href={`/${locale}/admin/customers/${u.id}`}

                      className="text-foreground underline-offset-4 hover:underline"

                      onClick={(e) => e.stopPropagation()}

                    >

                      <span>{u.fullName}</span>
                      {u.businessName ? (
                        <span className="ms-2 rounded-full border border-[#FF6B00]/30 bg-[#FF6B00]/10 px-2 py-0.5 text-[10px] font-semibold text-[#FF6B00]">
                          {u.businessName}
                        </span>
                      ) : null}

                    </Link>

                  </TableCell>

                  <TableCell className={cn(adminGlassTable.statusCell, 'align-middle')}>
                    <div className={cn(adminGlassTable.statusInner, 'justify-center')}>
                      {statusPill(u.customerLifecycle, t, locale)}
                    </div>
                  </TableCell>

                  <TableCell className="text-end font-mono-nums text-sm tabular-nums">
                    {u.totalWorkspaces}
                  </TableCell>

                  <TableCell className="align-middle text-xs">
                    <div className="flex justify-center">
                      <span className="inline-flex items-center justify-center rounded-full border border-[#FF6B00]/20 bg-[#FF6B00]/10 px-2.5 py-0.5 text-[11px] font-semibold text-foreground">
                        {formatSubscriptionStatus(u.subscriptionStatus, t)}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell className="text-xs text-muted-foreground">
                    {u.subscriptionEndDate
                      ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(u.subscriptionEndDate))
                      : t('table.noExpiry')}
                  </TableCell>

                  <TableCell className="text-end" onClick={(e) => e.stopPropagation()}>

                    <DropdownMenu>

                      <DropdownMenuTrigger asChild>

                        <Button

                          type="button"

                          variant="ghost"

                          size="icon"

                          className="h-9 w-9 rounded-xl"

                          aria-label={t('table.columns.actions')}

                        >

                          <MoreHorizontal className="h-4 w-4" />

                        </Button>

                      </DropdownMenuTrigger>

                      <DropdownMenuContent align="end" className="min-w-[12rem] rounded-2xl">

                        <DropdownMenuItem onClick={() => openProfile(u.id)}>
                          <ArrowUpRight className="me-2 h-4 w-4" />
                          {t('actions.openProfile')}
                        </DropdownMenuItem>

                        <DropdownMenuItem

                          disabled={u.id === meId}

                          onClick={() => setImpersonateTarget(u)}

                        >

                          <UserRoundCog className="me-2 h-4 w-4" />
                          {t('actions.impersonate')}

                        </DropdownMenuItem>

                        <DropdownMenuItem

                          onClick={() => setReminderTarget(u)}

                          disabled={u.customerLifecycle === 'suspended'}

                        >

                          <Send className="me-2 h-4 w-4" />

                          {t('actions.sendReminder')}

                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem

                          disabled={u.id === meId}

                          onClick={() => setSuspendTarget(u)}

                          className="text-red-400 focus:text-red-300"

                        >

                          <UserMinus className="me-2 h-4 w-4" />

                          {t('actions.suspend')}

                        </DropdownMenuItem>

                      </DropdownMenuContent>

                    </DropdownMenu>

                  </TableCell>

                </TableRow>

              ))}

            </TableBody>

          </Table>

        </div>
        ) : (
          <AdminEmptyState
            icon={Users}
            title={
              filter !== 'all' || debouncedSearch.trim()
                ? t('emptyFiltered')
                : t('empty')
            }
            description={
              filter !== 'all' || debouncedSearch.trim()
                ? t('emptyFilteredDescription')
                : t('emptyDescription')
            }
          />
        )}

      </div>



      <Dialog open={Boolean(suspendTarget)} onOpenChange={() => setSuspendTarget(null)}>

        <DialogContent className="rounded-3xl border-border/80 sm:max-w-md">

          <DialogHeader>

            <DialogTitle>{t('dialogs.suspendTitle')}</DialogTitle>

          </DialogHeader>

          <p className="text-sm text-muted-foreground">

            {t('dialogs.suspendBody', { email: suspendTarget?.email ?? '' })}

          </p>

          <DialogFooter>

            <Button variant="outline" className="rounded-2xl" onClick={() => setSuspendTarget(null)}>

              {t('dialogs.cancel')}

            </Button>

            <Button

              className="rounded-2xl bg-red-600 hover:bg-red-600/90"

              onClick={() => void confirmSuspend()}

            >

              {t('dialogs.suspend')}

            </Button>

          </DialogFooter>

        </DialogContent>

      </Dialog>



      <Dialog open={Boolean(impersonateTarget)} onOpenChange={() => setImpersonateTarget(null)}>

        <DialogContent className="rounded-3xl border-border/80 sm:max-w-md">

          <DialogHeader>

            <DialogTitle>{t('dialogs.impersonateTitle')}</DialogTitle>

          </DialogHeader>

          <p className="text-sm text-muted-foreground">

            {tImpersonation('confirmImpersonate')}

          </p>

          <DialogFooter>

            <Button variant="outline" className="rounded-2xl" onClick={() => setImpersonateTarget(null)}>

              {t('dialogs.cancel')}

            </Button>

            <Button

              className="rounded-2xl bg-[#FF6B00] font-semibold text-amber-950 hover:bg-[#FF6B00]/90"

              onClick={() => void confirmImpersonate()}

            >

              {t('dialogs.continue')}

            </Button>

          </DialogFooter>

        </DialogContent>

      </Dialog>



      <Dialog open={Boolean(reminderTarget)} onOpenChange={() => setReminderTarget(null)}>

        <DialogContent className="rounded-3xl border-border/80 sm:max-w-md">

          <DialogHeader>

            <DialogTitle>{t('dialogs.reminderTitle')}</DialogTitle>

          </DialogHeader>

          <p className="text-sm text-muted-foreground">

            {t('dialogs.reminderBody', { email: reminderTarget?.email ?? '' })}

          </p>

          <DialogFooter>

            <Button variant="outline" className="rounded-2xl" onClick={() => setReminderTarget(null)}>

              {t('dialogs.cancel')}

            </Button>

            <Button

              className="rounded-2xl bg-[#FF6B00] font-semibold text-amber-950 hover:bg-[#FF6B00]/90"

              disabled={sendingReminder}

              onClick={() => void confirmSendReminder()}

            >

              {t('dialogs.sendReminder')}

            </Button>

          </DialogFooter>

        </DialogContent>

      </Dialog>

    </>

  );

}
