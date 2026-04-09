'use client';

import type { Route } from 'next';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiFetch, setStoredAccessToken } from '@/features/auth/session';
import { useWorkspace } from '@/features/workspace/workspace-context';

export function ImpersonationReturnButton() {
  const locale = useLocale();
  const t = useTranslations('impersonation');
  const { impersonatedBySuperAdminId, refreshWorkspaces, businessName, userFullName } = useWorkspace();

  if (!impersonatedBySuperAdminId) return null;

  const onExit = async () => {
    const res = await apiFetch('/auth/exit-impersonation', { method: 'POST' });
    if (!res.ok) {
      toast.error(t('restoreFailed'));
      return;
    }
    const payload = (await res.json()) as {
      accessToken?: string;
      workspaces?: Array<{ id: string }>;
    };
    if (payload.accessToken) setStoredAccessToken(payload.accessToken);
    const first = payload.workspaces?.[0]?.id;
    await refreshWorkspaces(first ?? null);
    toast.success(t('restored'));
    window.location.assign(`/${locale}/admin/customers` as Route);
  };

  return (
    <div className="sticky top-0 z-[140] -mx-3 mb-4 border-b border-red-500/35 bg-gradient-to-r from-[#2e0707] via-[#5a0b0b] to-[#2e0707] px-3 py-2 shadow-[0_8px_26px_-16px_rgba(255,0,0,0.7)] sm:-mx-6 sm:px-6 lg:-mx-14 lg:px-14">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[#FF6B00]">
          {t('impersonatingAs')}{' '}
          <span className="text-white">{businessName ?? userFullName ?? '—'}</span>
        </p>
        <Button
          type="button"
          onClick={() => void onExit()}
          className="h-9 gap-2 rounded-xl border border-[#FF6B00]/40 bg-gradient-to-r from-[#FF6B00] to-amber-500 px-4 font-semibold text-amber-950 hover:opacity-95"
        >
          <Shield className="h-4 w-4" />
          {t('returnToAdmin')}
        </Button>
      </div>
    </div>
  );
}
