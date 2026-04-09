'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, CreditCard, Sparkles, Zap } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/features/auth/session';
import { useWorkspace } from '@/features/workspace/workspace-context';
import { cn } from '@/lib/utils';

type SubPayload = {
  workspaceId: string;
  plan: string;
  status: string;
  seats: number;
  screenLimit: number;
  currentPeriodEnd: string | null;
  startedAt: string;
};

export function BillingClient() {
  const t = useTranslations('billingClient');
  const locale = useLocale();
  const { workspaceId } = useWorkspace();
  const [sub, setSub] = useState<SubPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const res = await apiFetch(
      `/subscriptions/current?workspaceId=${encodeURIComponent(workspaceId)}`,
    );
    if (res.ok) {
      setSub((await res.json()) as SubPayload);
    } else {
      setSub(null);
    }
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!workspaceId) {
    return (
      <p className="text-[15px] text-muted-foreground">{t('selectWorkspace')}</p>
    );
  }

  const plan = sub?.plan ?? 'FREE';
  const isPro = plan === 'PRO' || plan === 'ENTERPRISE';

  return (
    <div className="space-y-10">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="vc-glass vc-card-surface rounded-3xl p-8"
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="vc-page-kicker">{t('kicker')}</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">{t('title')}</h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              {t('description')}
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-border/80 bg-muted/30 px-5 py-4">
            <CreditCard className="h-8 w-8 text-[#0F1729]" />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('currentPlan')}
              </p>
              <p className="font-mono-nums text-xs text-muted-foreground">
                {loading ? '…' : sub?.status ?? t('dash')}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <div
            className={cn(
              'relative overflow-hidden rounded-3xl border p-8',
              !isPro
                ? 'border-[#0F1729]/40 bg-gradient-to-br from-[#0F1729]/10 to-transparent shadow-lg shadow-[#0F1729]/10'
                : 'border-border/80 bg-card/80',
            )}
          >
            {!isPro ? (
              <span className="absolute end-4 top-4 rounded-full bg-[#FF6B00] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-950">
                {t('current')}
              </span>
            ) : null}
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                <Zap className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">{t('free')}</h3>
                <p className="font-mono-nums text-2xl font-bold text-foreground">
                  $0
                  <span className="text-sm font-normal text-muted-foreground">{t('perMonth')}</span>
                </p>
              </div>
            </div>
            <ul className="space-y-3 text-sm text-muted-foreground">
              {[t('freeFeatures.seat'), t('freeFeatures.scheduling'), t('freeFeatures.support')].map((feature) => (
                <li key={feature} className="flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-muted-foreground" />
                  {feature}
                </li>
              ))}
            </ul>
            <Button
              type="button"
              variant="outline"
              className="mt-8 w-full rounded-2xl border-[#0F1729]/20"
              disabled
            >
              {t('stripeSoon')}
            </Button>
          </div>

          <div
            className={cn(
              'relative overflow-hidden rounded-3xl border p-8',
              isPro
                ? 'border-[#FF6B00]/45 bg-gradient-to-br from-[#FF6B00]/15 to-[#0F1729]/10 shadow-xl shadow-[#FF6B00]/15'
                : 'border-border/80 bg-gradient-to-br from-muted/40 to-card',
            )}
          >
            {isPro ? (
              <span className="absolute end-4 top-4 rounded-full bg-[#FF6B00] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-950">
                {t('current')}
              </span>
            ) : null}
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0F1729] to-[#1e293b] shadow-md">
                <Sparkles className="h-6 w-6 text-[#FF6B00]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">{t('pro')}</h3>
                <p className="font-mono-nums text-2xl font-bold text-foreground">
                  $49
                  <span className="text-sm font-normal text-muted-foreground">{t('perMonth')}</span>
                </p>
              </div>
            </div>
            <ul className="space-y-3 text-sm text-muted-foreground">
              {[
                t('proFeatures.unlimited'),
                t('proFeatures.advanced'),
                t('proFeatures.prioritySync'),
                t('proFeatures.portal'),
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-[#0F1729] dark:text-[#FF6B00]" />
                  {feature}
                </li>
              ))}
            </ul>
            <Button
              type="button"
              className="mt-8 w-full rounded-2xl bg-gradient-to-r from-[#FF6B00] to-amber-500 font-semibold text-amber-950 shadow-lg hover:opacity-95"
              disabled
            >
              {t('upgradePlaceholder')}
            </Button>
          </div>
        </div>

        <div className="mt-10 rounded-2xl border border-dashed border-border/80 bg-muted/30 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {t('usageSnapshot')}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-[11px] text-muted-foreground">{t('plan')}</p>
              <p className="font-mono-nums text-lg font-semibold">{loading ? '…' : plan}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">{t('seats')}</p>
              <p className="font-mono-nums text-lg font-semibold">
                {loading ? '…' : sub?.seats ?? t('dash')}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">{t('screenLimit')}</p>
              <p className="font-mono-nums text-lg font-semibold">
                {loading ? '…' : sub?.screenLimit ?? t('dash')}
              </p>
            </div>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
