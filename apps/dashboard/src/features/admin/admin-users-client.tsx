'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Route } from 'next';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  MoreHorizontal,
  Pencil,
  Shield,
  UserCircle,
  UserMinus,
  UserRound,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { apiFetch, setStoredAccessToken } from '@/features/auth/session';
import { useWorkspace } from '@/features/workspace/workspace-context';
import { cn } from '@/lib/utils';

type PlatformRole = 'SUPER_ADMIN' | 'ADMIN' | 'USER';

type UserRow = {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  isSuperAdmin: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  storageBytes: number;
  totalWorkspaces: number;
  platformRole: PlatformRole;
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function roleBadge(
  role: PlatformRole,
  t: ReturnType<typeof useTranslations<'adminUsersDirectory'>>,
) {
  if (role === 'SUPER_ADMIN') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#FF6B00]/15 px-2.5 py-0.5 text-xs font-semibold text-amber-900 dark:text-[#FF6B00]">
        <Shield className="h-3 w-3" />
        {t('platformRoles.SUPER_ADMIN')}
      </span>
    );
  }
  if (role === 'ADMIN') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#1B254B]/20 px-2.5 py-0.5 text-xs font-semibold text-[#1B254B] dark:text-orange-200">
        <UserCircle className="h-3 w-3" />
        {t('platformRoles.ADMIN')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      <UserRound className="h-3 w-3" />
      {t('platformRoles.USER')}
    </span>
  );
}

export function AdminUsersClient() {
  const locale = useLocale();
  const t = useTranslations('adminUsersDirectory');
  const { refreshWorkspaces } = useWorkspace();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [meId, setMeId] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<UserRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editSuper, setEditSuper] = useState(false);
  const [saving, setSaving] = useState(false);

  const [suspendTarget, setSuspendTarget] = useState<UserRow | null>(null);
  const [impersonateTarget, setImpersonateTarget] = useState<UserRow | null>(null);

  const load = useCallback(async () => {
    const [meRes, listRes] = await Promise.all([
      apiFetch('/auth/me'),
      apiFetch('/admin/users'),
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
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const openEdit = (u: UserRow) => {
    setEditRow(u);
    setEditName(u.fullName);
    setEditSuper(u.isSuperAdmin);
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editRow) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/admin/users/${editRow.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          fullName: editName.trim(),
          isSuperAdmin: editSuper,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || 'Update failed');
      }
      toast.success(t('updateSuccess'));
      setEditOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('updateFailed'));
    } finally {
      setSaving(false);
    }
  };

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
    toast.success(t('suspendSuccess'));
    await load();
  };

  const confirmImpersonate = async () => {
    if (!impersonateTarget) return;
    const target = impersonateTarget;
    setImpersonateTarget(null);
    const res = await apiFetch(`/admin/users/${target.id}/impersonate`, {
      method: 'POST',
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
    toast.success(t('openingSessionAs', { email: target.email }));
    window.location.assign(`/${locale}/media` as Route);
  };

  const dateLocale = locale === 'ar' ? 'ar' : 'en-US';

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">{t('loadingDirectory')}</p>
    );
  }

  return (
    <>
      <div className="vc-card-surface overflow-hidden rounded-3xl border border-[#FF6B00]/15 shadow-[0_0_40px_-12px_rgba(255, 107, 0,0.25)]">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/60 bg-muted/30 hover:bg-muted/30">
                <TableHead className="font-semibold">{t('columns.name')}</TableHead>
                <TableHead className="font-semibold">{t('columns.email')}</TableHead>
                <TableHead className="font-semibold">{t('columns.role')}</TableHead>
                <TableHead className="text-end font-semibold tabular-nums">
                  {t('columns.workspaces')}
                </TableHead>
                <TableHead className="font-semibold">{t('columns.lastLogin')}</TableHead>
                <TableHead className="text-end font-semibold">{t('columns.storage')}</TableHead>
                <TableHead className="font-semibold">{t('columns.joined')}</TableHead>
                <TableHead className="w-[72px] text-end font-semibold">{t('columns.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((u) => (
                <TableRow
                  key={u.id}
                  className={cn(
                    'border-border/40',
                    !u.isActive && 'opacity-60',
                  )}
                >
                  <TableCell className="font-medium">{u.fullName}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {u.email}
                  </TableCell>
                  <TableCell>{roleBadge(u.platformRole, t)}</TableCell>
                  <TableCell className="text-end font-mono-nums text-sm tabular-nums">
                    {u.totalWorkspaces}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {u.lastLoginAt
                      ? new Date(u.lastLoginAt).toLocaleString(dateLocale)
                      : t('never')}
                  </TableCell>
                  <TableCell className="text-end font-mono text-xs tabular-nums text-muted-foreground">
                    {formatBytes(u.storageBytes)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {new Date(u.createdAt).toLocaleString(dateLocale)}
                  </TableCell>
                  <TableCell className="text-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-xl"
                          aria-label={t('actionsMenuAria')}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 rounded-xl">
                        <DropdownMenuItem
                          className="gap-2 rounded-lg"
                          onClick={() => openEdit(u)}
                        >
                          <Pencil className="h-4 w-4" />
                          {t('editUser')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="gap-2 rounded-lg"
                          disabled={u.id === meId || !u.isActive}
                          onClick={() => setSuspendTarget(u)}
                        >
                          <UserMinus className="h-4 w-4" />
                          {t('suspendAccount')}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="gap-2 rounded-lg"
                          disabled={u.id === meId || !u.isActive}
                          onClick={() => setImpersonateTarget(u)}
                        >
                          <UserCircle className="h-4 w-4" />
                          {t('impersonate')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">{t('empty')}</p>
        ) : null}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-3xl border-border/80 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('editDialogTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="admin-edit-name">{t('fullNameLabel')}</Label>
              <Input
                id="admin-edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border/80 bg-muted/30 px-4 py-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-border text-[#FF6B00] focus:ring-[#FF6B00]"
                checked={editSuper}
                onChange={(e) => setEditSuper(e.target.checked)}
                disabled={editRow?.id === meId}
              />
              <div>
                <p className="text-sm font-medium">{t('superAdminLabel')}</p>
                <p className="text-xs text-muted-foreground">{t('superAdminHint')}</p>
              </div>
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              type="button"
              className="bg-gradient-to-r from-[#FF6B00] to-amber-500 font-semibold text-amber-950 hover:opacity-95"
              disabled={saving}
              onClick={() => void saveEdit()}
            >
              {saving ? t('saving') : t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!suspendTarget} onOpenChange={() => setSuspendTarget(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('suspendTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('suspendDescription', { email: suspendTarget?.email ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-red-600 hover:bg-red-600"
              onClick={() => void confirmSuspend()}
            >
              {t('suspend')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!impersonateTarget} onOpenChange={() => setImpersonateTarget(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('impersonateTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('impersonateDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-gradient-to-r from-[#FF6B00] to-amber-500 font-semibold text-amber-950"
              onClick={() => void confirmImpersonate()}
            >
              {t('continue')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
