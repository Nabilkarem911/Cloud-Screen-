'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  ArrowLeft,
  BarChart3,
  Building2,
  Calendar,
  Gauge,
  HardDrive,
  Image as ImageIcon,
  LayoutGrid,
  ListMusic,
  Mail,
  MapPin,
  Monitor,
  Pencil,
  Phone,
  Plus,
  Send,
  Trash2,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { AdminCosmicLoader } from '@/components/admin/admin-cosmic-loader';
import { apiFetch, readApiErrorMessage, setStoredAccessToken } from '@/features/auth/session';
import { useWorkspace } from '@/features/workspace/workspace-context';
import { adminGlassTable } from '@/lib/admin-glass-table';
import { cn } from '@/lib/utils';

type Lifecycle = 'active' | 'expired' | 'suspended' | 'trial';

type SubStatus = 'ACTIVE' | 'TRIAL' | 'EXPIRED';

type BranchRow = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  screenCount: number;
  storageBytes: number;
};

type ProfilePayload = {
  id: string;
  email: string;
  fullName: string;
  businessName: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  subscriptionStatus: SubStatus;
  subscriptionEndDate: string | null;
  customerLifecycle: Lifecycle;
  branches: BranchRow[];
  usage: { totalScreens: number; totalStorageBytes: number };
  analytics: {
    screensByStatus: Record<string, number>;
    totalPlaylists: number;
    totalMedia: number;
    totalMediaBytes: number;
  };
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function toLocalDatetimeValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type ProfileTabId = 'overview' | 'subscription' | 'usage' | 'workspaces';

const PROFILE_TAB_ORDER: ProfileTabId[] = ['overview', 'subscription', 'usage', 'workspaces'];

function lifecycleBadge(lifecycle: Lifecycle, t: (key: string) => string) {
  if (lifecycle === 'suspended') {
    return (
      <span className="rounded-full border border-red-500/35 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-200">
        {t('lifecycle.suspended')}
      </span>
    );
  }
  if (lifecycle === 'expired') {
    return (
      <span className="rounded-full border border-amber-500/40 bg-amber-500/12 px-3 py-1 text-xs font-semibold text-amber-100">
        {t('lifecycle.expired')}
      </span>
    );
  }
  if (lifecycle === 'trial') {
    return (
      <span className="rounded-full border border-[#FF6B00]/45 bg-[#FF6B00]/12 px-3 py-1 text-xs font-semibold text-[#FF6B00]">
        {t('lifecycle.trial')}
      </span>
    );
  }
  return (
    <span className="rounded-full border border-emerald-500/35 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100">
      {t('lifecycle.active')}
    </span>
  );
}

export function AdminCustomerProfileClient({ customerId }: { customerId: string }) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations('adminCustomerProfile');
  const { refreshWorkspaces } = useWorkspace();
  const [data, setData] = useState<ProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [impersonatingWs, setImpersonatingWs] = useState<string | null>(null);
  const [sendingReminder, setSendingReminder] = useState(false);

  const [subStatus, setSubStatus] = useState<SubStatus>('ACTIVE');
  const [subEndLocal, setSubEndLocal] = useState('');
  const [accountEnabled, setAccountEnabled] = useState(true);
  const [savingSub, setSavingSub] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [adding, setAdding] = useState(false);

  const [editWs, setEditWs] = useState<BranchRow | null>(null);
  const [editName, setEditName] = useState('');
  const [savingWs, setSavingWs] = useState(false);

  const [deleteWs, setDeleteWs] = useState<BranchRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTabId>('overview');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch(`/admin/customers/${customerId}`);
    if (!res.ok) {
      toast.error(t('toastLoadFailed'));
      setData(null);
      setLoading(false);
      return;
    }
    const json = (await res.json()) as ProfilePayload;
    setData(json);
    setSubStatus(json.subscriptionStatus);
    setSubEndLocal(toLocalDatetimeValue(json.subscriptionEndDate));
    setAccountEnabled(json.isActive);
    setLoading(false);
  }, [customerId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveSubscription = async () => {
    if (!data) return;
    setSavingSub(true);
    try {
      const body: {
        subscriptionStatus: SubStatus;
        subscriptionEndDate: string | null;
        isActive: boolean;
      } = {
        subscriptionStatus: subStatus,
        isActive: accountEnabled,
        subscriptionEndDate: subEndLocal.trim()
          ? new Date(subEndLocal).toISOString()
          : null,
      };
      const res = await apiFetch(`/admin/customers/${customerId}/subscription`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const detail = await readApiErrorMessage(res);
        throw new Error(detail);
      }
      toast.success(t('toastSubUpdated'));
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toastSubSaveFailed'));
    } finally {
      setSavingSub(false);
    }
  };

  const createBranch = async () => {
    const name = addName.trim();
    if (name.length < 2) {
      toast.error(t('toastNameMin'));
      return;
    }
    setAdding(true);
    try {
      const res = await apiFetch(`/admin/customers/${customerId}/workspaces`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(t('toastWsCreated'));
      setAddOpen(false);
      setAddName('');
      await load();
    } catch {
      toast.error(t('toastWsCreateFailed'));
    } finally {
      setAdding(false);
    }
  };

  const saveBranchName = async () => {
    if (!editWs) return;
    const name = editName.trim();
    if (name.length < 2) {
      toast.error(t('toastNameMin'));
      return;
    }
    setSavingWs(true);
    try {
      const res = await apiFetch(
        `/admin/customers/${customerId}/workspaces/${editWs.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ name }),
        },
      );
      if (!res.ok) throw new Error('Failed');
      toast.success(t('toastBranchUpdated'));
      setEditWs(null);
      await load();
    } catch {
      toast.error(t('toastWsUpdateFailed'));
    } finally {
      setSavingWs(false);
    }
  };

  const removeBranch = async () => {
    if (!deleteWs) return;
    setDeleting(true);
    try {
      const res = await apiFetch(
        `/admin/customers/${customerId}/workspaces/${deleteWs.id}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error('Failed');
      toast.success(t('toastWsRemoved'));
      setDeleteWs(null);
      await load();
    } catch {
      toast.error(t('toastWsDeleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  const impersonateBranch = async (workspaceId: string) => {
    if (!data) return;
    setImpersonatingWs(workspaceId);
    try {
      const res = await apiFetch(`/admin/users/${data.id}/impersonate`, {
        method: 'POST',
        body: JSON.stringify({ workspaceId }),
      });
      if (!res.ok) {
        toast.error(t('toastImpersonateFailed'));
        return;
      }
      const payload = (await res.json()) as {
        accessToken?: string;
        workspaces?: Array<{ id: string }>;
      };
      if (payload.accessToken) {
        setStoredAccessToken(payload.accessToken);
      }
      const first = payload.workspaces?.[0]?.id ?? workspaceId;
      await refreshWorkspaces(first);
      toast.success(t('toastEnteringWs'));
      window.location.assign(`/${locale}/media` as Route);
    } finally {
      setImpersonatingWs(null);
    }
  };

  const sendReminder = async () => {
    setSendingReminder(true);
    try {
      const res = await apiFetch(`/admin/customers/${customerId}/reminder`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed');
      const body = (await res.json()) as { message?: string };
      toast.success(body.message ?? t('toastReminderDefault'));
    } catch {
      toast.error(t('toastReminderFailed'));
    } finally {
      setSendingReminder(false);
    }
  };

  if (loading) {
    return <AdminCosmicLoader label={t('loading')} />;
  }

  if (!data) {
    return (
      <div className="rounded-3xl border border-[#FF6B00]/15 bg-muted/20 p-8 text-center">
        <p className="text-sm text-muted-foreground">{t('notFound')}</p>
        <Button
          type="button"
          variant="outline"
          className="mt-4 rounded-2xl border-[#FF6B00]/30"
          onClick={() => router.push(`/${locale}/admin/customers` as Route)}
        >
          {t('backToHub')}
        </Button>
      </div>
    );
  }

  const statusEntries = Object.entries(data.analytics.screensByStatus).filter(
    ([, n]) => n > 0,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Link
          href={`/${locale}/admin/customers`}
          className="inline-flex items-center gap-2 text-sm font-medium text-[#94A3B8] transition hover:text-[#FF6B00]"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('linkHub')}
        </Link>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-2xl border-[#FF6B00]/35 bg-[#FF6B00]/5 hover:bg-[#FF6B00]/10"
            disabled={sendingReminder}
            onClick={() => void sendReminder()}
          >
            <Send className="me-2 h-4 w-4" />
            {t('sendReminder')}
          </Button>
        </div>
      </div>

      <div
        role="tablist"
        aria-label={t('tabsAria')}
        className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible sm:pb-0"
      >
        {PROFILE_TAB_ORDER.map((tabId) => (
          <button
            key={tabId}
            type="button"
            role="tab"
            id={`customer-tab-${tabId}`}
            aria-selected={activeTab === tabId}
            aria-controls={`customer-panel-${tabId}`}
            onClick={() => setActiveTab(tabId)}
            className={cn(
              'shrink-0 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition-all sm:px-4',
              activeTab === tabId
                ? 'border-[#FF6B00]/55 bg-[#FF6B00]/15 text-[#FF6B00] shadow-[0_0_24px_-8px_rgba(255,107,0,0.45)]'
                : 'border-white/10 bg-card/30 text-muted-foreground hover:border-[#FF6B00]/30 hover:text-foreground',
            )}
          >
            {tabId === 'overview' && t('tabs.overview')}
            {tabId === 'subscription' && t('tabs.subscription')}
            {tabId === 'usage' && t('tabs.usage')}
            {tabId === 'workspaces' && t('tabs.workspaces')}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div
          role="tabpanel"
          id="customer-panel-overview"
          aria-labelledby="customer-tab-overview"
          className="space-y-6"
        >
          <section className="relative overflow-hidden rounded-3xl border border-[#FF6B00]/20 bg-gradient-to-br from-[#1a1208] via-card to-[#0f0a14] p-4 shadow-[0_0_60px_-20px_rgba(255, 107, 0,0.35)] sm:p-6 md:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#FF6B00]/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="space-y-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#94A3B8]">
              {t('heroKicker')}
            </p>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl md:text-3xl">
                {data.fullName}
              </h1>
              {lifecycleBadge(data.customerLifecycle, t)}
            </div>
            {data.businessName ? (
              <p className="text-sm font-medium text-[#FF6B00]/90">{data.businessName}</p>
            ) : null}
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div className="flex items-start gap-2 text-muted-foreground">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6B00]/80" />
                <span className="font-mono text-xs text-foreground/90">{data.email}</span>
              </div>
              {data.phone ? (
                <div className="flex items-start gap-2 text-muted-foreground">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6B00]/80" />
                  <span className="text-foreground/90">{data.phone}</span>
                </div>
              ) : null}
              {(data.country || data.city) && (
                <div className="flex items-start gap-2 text-muted-foreground sm:col-span-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6B00]/80" />
                  <span className="text-foreground/90">
                    {[data.city, data.country].filter(Boolean).join(', ')}
                  </span>
                </div>
              )}
              <div className="flex items-start gap-2 text-muted-foreground">
                <User className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6B00]/80" />
                <span>
                  {t('accountLabel')}:{' '}
                  <span className="text-foreground/90">
                    {data.isActive ? t('enabled') : t('disabled')}
                  </span>
                </span>
              </div>
              <div className="flex items-start gap-2 text-muted-foreground">
                <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6B00]/80" />
                <span>
                  {t('joined')}{' '}
                  {new Date(data.createdAt).toLocaleDateString(undefined, {
                    dateStyle: 'long',
                  })}
                </span>
              </div>
              <div className="flex items-start gap-2 text-muted-foreground sm:col-span-2">
                <Gauge className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6B00]/80" />
                <span>
                  {t('plan')}:{' '}
                  <span className="font-medium text-[#FF6B00]/90">
                    {data.subscriptionStatus === 'ACTIVE'
                      ? t('subscriptionPlan.ACTIVE')
                      : data.subscriptionStatus === 'TRIAL'
                        ? t('subscriptionPlan.TRIAL')
                        : t('subscriptionPlan.EXPIRED')}
                  </span>
                  {data.subscriptionEndDate ? (
                    <span className="text-muted-foreground">
                      {' '}
                      · {t('ends')}{' '}
                      {new Date(data.subscriptionEndDate).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </span>
                  ) : null}
                </span>
              </div>
            </div>
          </div>

          <div className="grid min-w-[220px] gap-3 rounded-2xl border border-[#FF6B00]/15 bg-black/20 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#94A3B8]">
              {t('usageTitle')}
            </p>
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Monitor className="h-4 w-4 text-[#FF6B00]" />
                {t('screens')}
              </span>
              <span className="font-mono text-lg font-semibold tabular-nums text-foreground">
                {data.usage.totalScreens}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <HardDrive className="h-4 w-4 text-[#FF6B00]" />
                {t('storage')}
              </span>
              <span className="font-mono text-lg font-semibold tabular-nums text-[#FF6B00]">
                {formatBytes(data.usage.totalStorageBytes)}
              </span>
            </div>
          </div>
        </div>
      </section>

          <section className="rounded-3xl border border-[#FF6B00]/15 bg-muted/15 p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <LayoutGrid className="h-5 w-5 shrink-0 text-[#FF6B00]" />
              <h2 className="text-lg font-semibold tracking-tight">{t('overviewKpiTitle')}</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-[#FF6B00]/10 bg-muted/25 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                  {t('kpiBranches')}
                </p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-foreground">
                  {data.branches.length}
                </p>
              </div>
              <div className="rounded-2xl border border-[#FF6B00]/10 bg-muted/25 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                  {t('screens')}
                </p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-foreground">
                  {data.usage.totalScreens}
                </p>
              </div>
              <div className="rounded-2xl border border-[#FF6B00]/10 bg-muted/25 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                  {t('kpiPlaylists')}
                </p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-foreground">
                  {data.analytics.totalPlaylists}
                </p>
              </div>
              <div className="rounded-2xl border border-[#FF6B00]/10 bg-muted/25 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                  {t('kpiMediaItems')}
                </p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-foreground">
                  {data.analytics.totalMedia}
                </p>
              </div>
            </div>
          </section>
        </div>
      )}

      {activeTab === 'subscription' && (
        <div
          role="tabpanel"
          id="customer-panel-subscription"
          aria-labelledby="customer-tab-subscription"
          className="space-y-6"
        >
      <section className="rounded-3xl border border-[#FF6B00]/15 bg-muted/15 p-4 shadow-inner sm:p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Gauge className="h-5 w-5 text-[#FF6B00]" />
          {t('subscriptionTitle')}
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="sub-status">{t('planStatus')}</Label>
            <select
              id="sub-status"
              value={subStatus}
              onChange={(e) => setSubStatus(e.target.value as SubStatus)}
              className={cn(
                'flex h-10 w-full rounded-xl border border-[#FF6B00]/25 bg-background px-3 text-sm',
                'ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]/40',
              )}
            >
              <option value="ACTIVE">{t('subscriptionPlan.ACTIVE')}</option>
              <option value="TRIAL">{t('subscriptionPlan.TRIAL')}</option>
              <option value="EXPIRED">{t('subscriptionPlan.EXPIRED')}</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sub-end">{t('planEnd')}</Label>
            <Input
              id="sub-end"
              type="datetime-local"
              value={subEndLocal}
              onChange={(e) => setSubEndLocal(e.target.value)}
              className="rounded-xl"
            />
            <p className="text-[11px] text-muted-foreground">{t('clearEndHint')}</p>
          </div>
          <div className="flex flex-col justify-end gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-[#FF6B00]/40"
                checked={accountEnabled}
                onChange={(e) => setAccountEnabled(e.target.checked)}
              />
              {t('accountAccessEnabled')}
            </label>
            <Button
              type="button"
              className="rounded-2xl bg-[#FF6B00] font-semibold text-amber-950 hover:bg-[#FF6B00]/90"
              disabled={savingSub}
              onClick={() => void saveSubscription()}
            >
              {savingSub ? t('savingSubscription') : t('saveSubscription')}
            </Button>
          </div>
        </div>
      </section>
        </div>
      )}

      {activeTab === 'usage' && (
        <div
          role="tabpanel"
          id="customer-panel-usage"
          aria-labelledby="customer-tab-usage"
          className="space-y-6"
        >
      <section className="rounded-3xl border border-[#FF6B00]/15 bg-card/40 p-4 sm:p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold tracking-tight">
          <BarChart3 className="h-5 w-5 text-[#FF6B00]" />
          {t('analyticsTitle')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-[#FF6B00]/10 bg-muted/20 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
              {t('playlists')}
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">
              {data.analytics.totalPlaylists}
            </p>
          </div>
          <div className="rounded-2xl border border-[#FF6B00]/10 bg-muted/20 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
              {t('mediaFiles')}
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">
              {data.analytics.totalMedia}
            </p>
          </div>
          <div className="rounded-2xl border border-[#FF6B00]/10 bg-muted/20 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
              {t('mediaStorage')}
            </p>
            <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-[#FF6B00]">
              {formatBytes(data.analytics.totalMediaBytes)}
            </p>
          </div>
          <div className="rounded-2xl border border-[#FF6B00]/10 bg-muted/20 p-4 sm:col-span-2 lg:col-span-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
              {t('screensByStatus')}
            </p>
            {statusEntries.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">{t('noScreensYet')}</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {statusEntries.map(([status, count]) => (
                  <li key={status} className="flex justify-between gap-2 font-mono text-xs">
                    <span className="text-muted-foreground">{status}</span>
                    <span className="tabular-nums text-foreground">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
        </div>
      )}

      {activeTab === 'workspaces' && (
        <div
          role="tabpanel"
          id="customer-panel-workspaces"
          aria-labelledby="customer-tab-workspaces"
          className="space-y-6"
        >
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[#FF6B00]" />
            <h2 className="text-lg font-semibold tracking-tight">{t('branchesTitle')}</h2>
          </div>
          <Button
            type="button"
            size="sm"
            className="rounded-xl bg-[#FF6B00] font-semibold text-amber-950 hover:bg-[#FF6B00]/90"
            onClick={() => {
              setAddName('');
              setAddOpen(true);
            }}
          >
            <Plus className="me-1.5 h-4 w-4" />
            {t('addBranch')}
          </Button>
        </div>
        <div className={cn(adminGlassTable.wrap, 'shadow-[0_0_40px_-12px_rgba(255, 107, 0,0.25)]')}>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className={adminGlassTable.theadRow}>
                  <TableHead className={cn(adminGlassTable.th, 'text-start')}>{t('colBranch')}</TableHead>
                  <TableHead className={cn(adminGlassTable.th, 'text-start')}>{t('colCreated')}</TableHead>
                  <TableHead className={cn(adminGlassTable.th, 'text-end tabular-nums')}>{t('colScreens')}</TableHead>
                  <TableHead className={cn(adminGlassTable.th, 'text-end')}>{t('colStorage')}</TableHead>
                  <TableHead className={cn(adminGlassTable.th, 'w-[220px] text-end')}>{t('colActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.branches.map((b) => (
                  <TableRow key={b.id} className={adminGlassTable.tbodyRow}>
                    <TableCell>
                      <Link
                        href={`/${locale}/admin/customers/${customerId}/workspace/${b.id}` as Route}
                        className="group block max-w-[min(100%,280px)] rounded-lg outline-none ring-offset-background transition hover:text-[#FF6B00] focus-visible:ring-2 focus-visible:ring-[#FF6B00]/40"
                        aria-label={t('openBranchDetails')}
                      >
                        <p className="font-medium group-hover:underline">{b.name}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">{b.slug}</p>
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(b.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-end font-mono text-sm tabular-nums">
                      {b.screenCount}
                    </TableCell>
                    <TableCell className="text-end font-mono text-xs tabular-nums text-muted-foreground">
                      {formatBytes(b.storageBytes)}
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-lg border-[#FF6B00]/30 px-2"
                          onClick={() => {
                            setEditWs(b);
                            setEditName(b.name);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-lg border-red-500/30 px-2 text-red-400 hover:bg-red-500/10"
                          onClick={() => setDeleteWs(b)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="rounded-lg bg-[#FF6B00] px-2 font-semibold text-amber-950 hover:bg-[#FF6B00]/90"
                          disabled={impersonatingWs === b.id}
                          onClick={() => void impersonateBranch(b.id)}
                        >
                          {t('open')}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {data.branches.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">{t('emptyBranches')}</p>
          ) : null}
        </div>
      </section>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="rounded-3xl border-border/80 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('dialogNewTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>{t('displayName')}</Label>
            <Input
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder={t('branchPlaceholder')}
              className="rounded-xl"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-2xl" onClick={() => setAddOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              className="rounded-2xl bg-[#FF6B00] font-semibold text-amber-950 hover:bg-[#FF6B00]/90"
              disabled={adding}
              onClick={() => void createBranch()}
            >
              {t('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editWs)} onOpenChange={() => setEditWs(null)}>
        <DialogContent className="rounded-3xl border-border/80 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('dialogRenameTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>{t('displayName')}</Label>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-2xl" onClick={() => setEditWs(null)}>
              {t('cancel')}
            </Button>
            <Button
              className="rounded-2xl bg-[#FF6B00] font-semibold text-amber-950 hover:bg-[#FF6B00]/90"
              disabled={savingWs}
              onClick={() => void saveBranchName()}
            >
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteWs)} onOpenChange={() => setDeleteWs(null)}>
        <DialogContent className="rounded-3xl border-border/80 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('dialogDeleteTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('dialogDeleteBody', { name: deleteWs?.name ?? '' })}
          </p>
          <DialogFooter>
            <Button variant="outline" className="rounded-2xl" onClick={() => setDeleteWs(null)}>
              {t('cancel')}
            </Button>
            <Button
              className="rounded-2xl bg-red-600 hover:bg-red-600/90"
              disabled={deleting}
              onClick={() => void removeBranch()}
            >
              {t('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
