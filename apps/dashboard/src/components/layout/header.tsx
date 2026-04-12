'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { ArrowLeft, Menu, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ShellLogo } from '@/components/layout/shell-logo';
import { Button } from '@/components/ui/button';
import { UserMenu } from '@/components/user-menu';
import { WorkspaceSwitcher } from '@/features/workspace/workspace-switcher';
import { ICON_STROKE } from '@/lib/icon-stroke';
import { cn } from '@/lib/utils';

type ShellHeaderProps = {
  navLocale: 'ar' | 'en';
  rtl: boolean;
  sovereign: boolean;
  pageTitle: string;
  kicker: string;
  showBack: boolean;
  backHref: string | null;
  backLabel: string;
  mobileNavOpen: boolean;
  onToggleMobileNav: () => void;
  showWorkspaceSwitcher: boolean;
  /** Branch tools etc.: beside page title on desktop; extra row on small screens. */
  headerInset?: ReactNode;
};

export function ShellHeader({
  navLocale,
  rtl,
  sovereign,
  pageTitle,
  kicker,
  showBack,
  backHref,
  backLabel,
  mobileNavOpen,
  onToggleMobileNav,
  showWorkspaceSwitcher,
  headerInset,
}: ShellHeaderProps) {
  const t = useTranslations('nav');

  const backBtn = showBack && backHref && (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn(
        'h-8 w-8 shrink-0 rounded-full border-white/20 bg-white/60 backdrop-blur-sm transition-all dark:border-white/15 dark:bg-[#1B254B]/35',
        'text-brand-orange hover:bg-white/80 dark:text-brand-orange dark:hover:bg-white/10',
        rtl && 'rotate-180',
      )}
      asChild
    >
      <Link href={backHref as Route} aria-label={backLabel}>
        <ArrowLeft className="h-4 w-4" strokeWidth={ICON_STROKE} />
      </Link>
    </Button>
  );

  const titleBlock = (
    <div
      className={cn(
        'min-w-0 flex flex-col justify-center',
        headerInset ? 'shrink-0' : 'flex-1',
        rtl ? 'items-end text-right' : 'items-start text-left',
      )}
    >
      {kicker ? (
        <p
          className={cn(
            'text-[7px] font-semibold uppercase tracking-[0.2em] sm:text-[8px]',
            'text-[#1B254B]/70 dark:text-white/60',
          )}
        >
          {kicker}
        </p>
      ) : null}
      <p
        className={cn(
          'shell-header-title w-full truncate text-[15px] font-bold leading-tight tracking-tight sm:text-[17px]',
          headerInset && 'max-w-[10rem] sm:max-w-[14rem] lg:max-w-[18rem]',
          'text-[#1B254B] dark:text-white',
          'transition-colors',
        )}
      >
        {pageTitle}
      </p>
    </div>
  );

  const menuBtn = (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="z-[80] h-8 w-8 shrink-0 rounded-full border-white/20 bg-white/60 backdrop-blur-sm dark:border-white/15 dark:bg-[#1B254B]/35 sm:h-9 sm:w-9 lg:hidden"
      onClick={onToggleMobileNav}
      aria-label={t('toggleMenu')}
    >
      {mobileNavOpen ? (
        <X className="h-4 w-4 text-[#1B254B] dark:text-white" strokeWidth={ICON_STROKE} />
      ) : (
        <Menu className="h-4 w-4 text-[#1B254B] dark:text-white" strokeWidth={ICON_STROKE} />
      )}
    </Button>
  );

  const mobileLogo = (
    <div className="flex h-9 items-center rounded-full border border-white/20 bg-white/60 px-3 backdrop-blur-sm dark:border-white/15 dark:bg-[#1B254B]/35 lg:hidden">
      <ShellLogo locale={navLocale} className="max-h-[28px] max-w-[120px]" />
    </div>
  );

  const desktopActions = (
    <div className="hidden shrink-0 flex-nowrap items-center justify-end gap-2.5 lg:flex">
      {showWorkspaceSwitcher ? <WorkspaceSwitcher /> : null}
      <UserMenu rtl={rtl} variant={sovereign ? 'sovereign' : 'workspace'} />
    </div>
  );

  return (
    <header
      className={cn(
        'relative sticky top-0 z-[55] flex min-h-[52px] shrink-0 flex-col border-b-0',
        'bg-transparent supports-[backdrop-filter]:bg-white/[0.04] supports-[backdrop-filter]:backdrop-blur-[2px]',
        'dark:bg-transparent dark:supports-[backdrop-filter]:bg-[rgb(27_37_75_/0.06)]',
      )}
    >
      <div className="relative z-[3] mx-auto flex min-h-[52px] w-full max-w-[1600px] items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-10">
        <div className="flex shrink-0 items-center">
          {mobileLogo}
        </div>

        {/* Desktop title row only. Mobile/tablet header hides page title by request. */}
        <div
          dir={rtl ? 'rtl' : 'ltr'}
          className={cn(
            'hidden min-w-0 flex-1 flex-row items-center gap-2 sm:gap-3 lg:flex',
            headerInset ? 'min-w-0 justify-start' : rtl ? 'justify-start' : 'justify-end',
          )}
        >
          {backBtn}
          {titleBlock}
          {headerInset ? (
            <div className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1">
              {headerInset}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center">
          {menuBtn}
        </div>

        {desktopActions}
      </div>
      {headerInset ? (
        <div
          dir={rtl ? 'rtl' : 'ltr'}
          className="border-b border-[#FF6B00]/10 bg-background/40 px-3 py-2 backdrop-blur-sm supports-[backdrop-filter]:bg-white/[0.03] dark:border-white/10 dark:supports-[backdrop-filter]:bg-[rgb(27_37_75_/0.12)] lg:hidden"
        >
          <div className="mx-auto flex w-full max-w-[1600px] justify-center overflow-x-auto sm:px-3">
            {headerInset}
          </div>
        </div>
      ) : null}
      <div
        className="pointer-events-none h-px w-full shrink-0 bg-[#FF6B00] shadow-[0_0_10px_#FF6B00]"
        aria-hidden
      />
    </header>
  );
}
