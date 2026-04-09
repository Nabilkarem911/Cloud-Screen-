'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useTranslations } from 'next-intl';
import { Clapperboard, Image as ImageIcon, Monitor, PenLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ICON_STROKE } from '@/lib/icon-stroke';
import { cn } from '@/lib/utils';

type Props = {
  locale: string;
  branchName: string;
  onNewScreen: () => void;
};

export function BranchWorkspaceToolbar({ locale, branchName, onNewScreen }: Props) {
  const t = useTranslations('branchToolbar');
  const base = `/${locale}`;

  const links = [
    { href: `${base}/playlists` as Route, label: t('playlists'), icon: Clapperboard },
    { href: `${base}/screens` as Route, label: t('screens'), icon: Monitor },
    { href: `${base}/media` as Route, label: t('media'), icon: ImageIcon },
  ] as const;

  return (
    <div
      className={cn(
        'flex flex-col gap-5 rounded-3xl border border-[#FF6B00]/12 bg-gradient-to-br from-[#0F1729]/40 via-transparent to-[#FF6B00]/[0.06] p-5 sm:p-6',
        'dark:border-white/10 dark:from-[#0B1220]/80',
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {t('branchLabel')}
          </p>
          <h1 className="mt-1.5 text-balance text-2xl font-bold leading-tight tracking-tight text-foreground dark:text-white sm:text-3xl">
            <span className="line-clamp-3 break-words">{branchName}</span>
          </h1>
        </div>
        <nav
          className="flex flex-wrap items-center gap-2 lg:max-w-[min(100%,520px)] lg:justify-end"
          aria-label={t('navAria')}
        >
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl border border-[#FF6B00]/25 bg-white/60 px-3.5 py-2.5 text-sm font-semibold',
                'text-[#1B254B] shadow-sm transition hover:border-[#FF6B00]/50 hover:bg-[#FF6B00]/10',
                'dark:border-white/15 dark:bg-[#1B254B]/50 dark:text-white dark:hover:bg-[#FF6B00]/15',
              )}
            >
              <item.icon className="h-4 w-4 shrink-0 text-[#FF6B00]" strokeWidth={ICON_STROKE} />
              {item.label}
            </Link>
          ))}
          <Button
            type="button"
            onClick={onNewScreen}
            className="rounded-xl bg-[#FF6B00] px-4 py-2.5 font-semibold text-amber-950 shadow-md shadow-[#FF6B00]/20 hover:bg-[#FF6B00]/90"
          >
            <PenLine className="me-2 inline h-4 w-4" strokeWidth={ICON_STROKE} />
            {t('newScreen')}
          </Button>
        </nav>
      </div>
    </div>
  );
}
