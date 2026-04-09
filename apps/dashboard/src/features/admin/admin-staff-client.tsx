'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Loader2, Plus, Shield, UserCog } from 'lucide-react';
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
import { AdminEmptyState } from '@/components/admin/admin-empty-state';
import { AdminCosmicLoader } from '@/components/admin/admin-cosmic-loader';
import { apiFetch, readApiErrorMessage } from '@/features/auth/session';
import { adminGlassTable } from '@/lib/admin-glass-table';
import { cn } from '@/lib/utils';

type StaffRole = 'SUPER_ADMIN' | 'ADMIN' | 'EDITOR' | 'VIEWER';

type StaffRow = {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  adminRole: StaffRole;
  lastLoginAt: string | null;
};

export function AdminStaffClient() {
  const locale = useLocale();
  const t = useTranslations('adminStaff');
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<StaffRole>('ADMIN');
  const roleOptions: { value: StaffRole; label: string }[] = [
    { value: 'SUPER_ADMIN', label: t('roles.superAdmin') },
    { value: 'ADMIN', label: t('roles.admin') },
    { value: 'EDITOR', label: t('roles.editor') },
    { value: 'VIEWER', label: t('roles.viewer') },
  ];
  const inviteRoleOptions = roleOptions.filter((r) => r.value !== 'SUPER_ADMIN');

  const load = useCallback(async () => {
    const res = await apiFetch('/admin/staff');
    if (!res.ok) {
      toast.error(t('loadFailed'));
      setLoading(false);
      return;
    }
    const data = (await res.json()) as StaffRow[];
    setRows(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateRole = async (userId: string, role: StaffRole) => {
    setSavingId(userId);
    try {
      const res = await apiFetch(`/admin/staff/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ adminRole: role }),
      });
      if (!res.ok) {
        toast.error(t('updateRoleFailed'));
        return;
      }
      toast.success(t('updated'));
      await load();
    } finally {
      setSavingId(null);
    }
  };

  const createStaff = async () => {
    setCreating(true);
    try {
      const res = await apiFetch('/admin/staff', {
        method: 'POST',
        body: JSON.stringify({
          fullName: newName.trim(),
          email: newEmail.trim().toLowerCase(),
          password: newPassword,
          adminRole: newRole,
        }),
      });
      if (!res.ok) {
        const detail = await readApiErrorMessage(res);
        toast.error(detail || t('createFailed'));
        return;
      }
      toast.success(t('created'));
      setCreateOpen(false);
      setNewEmail('');
      setNewName('');
      setNewPassword('');
      setNewRole('ADMIN');
      await load();
    } finally {
      setCreating(false);
    }
  };

  const disableStaff = async (userId: string) => {
    setSavingId(userId);
    try {
      const res = await apiFetch(`/admin/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: false }),
      });
      if (!res.ok) {
        toast.error(t('disableFailed'));
        return;
      }
      toast.success(t('disabled'));
      await load();
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return <AdminCosmicLoader label={t('loading')} />;
  }

  const dash = '—';

  return (
    <div className={cn(adminGlassTable.wrap, 'flex flex-col')}>
      <div className="flex items-center justify-between border-b border-[#FF6B00]/15 bg-card/20 px-4 py-3 backdrop-blur-md sm:px-6">
        <p className="text-sm font-semibold text-muted-foreground">{t('title')}</p>
        <Button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded-xl bg-[#FF6B00] font-semibold text-amber-950 hover:bg-[#FF6B00]/90"
        >
          <Plus className="me-2 h-4 w-4" />
          {t('create')}
        </Button>
      </div>

      {rows.length === 0 ? (
        <AdminEmptyState icon={UserCog} title={t('empty')} description={t('emptyDescription')} />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className={adminGlassTable.theadRow}>
                <TableHead className={cn(adminGlassTable.th, 'text-start')}>
                  {t('columns.name')}
                </TableHead>
                <TableHead className={cn(adminGlassTable.th, 'text-start')}>
                  {t('columns.email')}
                </TableHead>
                <TableHead className={cn(adminGlassTable.th, 'min-w-[220px] text-start')}>
                  {t('columns.role')}
                </TableHead>
                <TableHead className={cn(adminGlassTable.th, 'text-start')}>
                  {t('columns.lastLogin')}
                </TableHead>
                <TableHead className={cn(adminGlassTable.th, 'text-end')}>
                  {t('columns.actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((u) => (
                <TableRow
                  key={u?.id ?? Math.random()}
                  className={cn(adminGlassTable.tbodyRow, !u?.isActive && 'opacity-60')}
                >
                  <TableCell className="font-medium">{u?.fullName ?? dash}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {u?.email ?? dash}
                  </TableCell>
                  <TableCell className={adminGlassTable.statusCell}>
                    <div className={cn(adminGlassTable.statusInner, 'justify-start sm:ps-1')}>
                      <div className="flex w-full max-w-[280px] items-center gap-2">
                        <Shield className="h-4 w-4 shrink-0 text-[#FF6B00]" aria-hidden />
                        <select
                          className="h-10 w-full rounded-xl border border-border bg-card/80 px-3 text-[14px] font-medium shadow-inner outline-none backdrop-blur-sm focus:border-[#FF6B00]/40 focus:ring-2 focus:ring-[#FF6B00]/15"
                          value={(u?.adminRole as StaffRole) ?? 'VIEWER'}
                          disabled={savingId === u?.id}
                          onChange={(e) => {
                            const v = e.target.value as StaffRole;
                            if (!u?.id) return;
                            void updateRole(u.id, v);
                          }}
                        >
                          {roleOptions.map((o) => (
                            <option key={o.value ?? 'none'} value={o.value ?? ''}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        {savingId === u?.id ? (
                          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#FF6B00]" aria-hidden />
                        ) : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {u?.lastLoginAt
                      ? new Intl.DateTimeFormat(locale, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }).format(new Date(u.lastLoginAt))
                      : t('never')}
                  </TableCell>
                  <TableCell className="text-end align-middle">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-lg border-red-500/35 text-red-400 hover:bg-red-500/10"
                      disabled={savingId === u?.id || !u?.id}
                      onClick={() => {
                        if (!u?.id) return;
                        void disableStaff(u.id);
                      }}
                    >
                      {t('disable')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="border-t border-[#FF6B00]/10 px-6 py-4 text-[12px] text-muted-foreground">
        {t('footer')}
      </p>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-3xl border-[#FF6B00]/15 bg-card/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>{t('createDialog.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>{t('createDialog.name')}</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{t('createDialog.email')}</Label>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{t('createDialog.password')}</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{t('createDialog.role')}</Label>
              <select
                className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as StaffRole)}
              >
                {inviteRoleOptions.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t('createDialog.cancel')}
            </Button>
            <Button
              className="bg-[#FF6B00] font-semibold text-amber-950 hover:bg-[#FF6B00]/90"
              onClick={() => void createStaff()}
              disabled={creating}
            >
              <span className="inline-flex items-center gap-2">
                {creating ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-amber-950" aria-hidden />
                ) : null}
                {t('createDialog.submit')}
              </span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
