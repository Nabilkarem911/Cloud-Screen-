'use client';

import * as React from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  Activity,
  CalendarClock,
  ChevronDown,
  CreditCard,
  Image as ImageIcon,
  LayoutDashboard,
  ListMusic,
  LogOut,
  Monitor,
  Moon,
  PenLine,
  ScrollText,
  Settings,
  SlidersHorizontal,
  Sun,
  UserRound,
  UserCog,
  Users,
} from 'lucide-react';
import { ShellLogo } from '@/components/layout/shell-logo';
import { pathWithLocale } from '@/components/language-switcher';
import { WorkspaceSwitcher } from '@/features/workspace/workspace-switcher';
import { apiFetch, setStoredAccessToken } from '@/features/auth/session';
import { ICON_STROKE } from '@/lib/icon-stroke';
import { cn } from '@/lib/utils';

/** Sidebar nav: stronger strokes read on crystal-orange glass */
const NAV_ICON_STROKE = 2;

const CLIENT_NAV = [
  { key: 'home', hrefKey: 'overview' as const, icon: LayoutDashboard },
  { key: 'screens', hrefKey: 'screens' as const, icon: Monitor },
  { key: 'media', hrefKey: 'media' as const, icon: ImageIcon },
  { key: 'studio', hrefKey: 'studio' as const, icon: PenLine },
  { key: 'playlists', hrefKey: 'playlists' as const, icon: ListMusic },
  { key: 'schedules', hrefKey: 'schedules' as const, icon: CalendarClock },
  { key: 'team', hrefKey: 'team' as const, icon: Users },
] as const;

/** Orange crystal — white labels; active = identity orange icon + glow + bg-white/5 */
function shellNavAccent() {
  return {
    hover: 'hover:bg-white/10',
    iconActive: 'text-[#FF6B00] drop-shadow-[0_0_8px_rgba(255,107,0,0.5)]',
    iconInactive: 'text-white/90',
    labelActive: 'font-bold text-white',
    labelInactive: 'font-medium text-white/95',
    section: 'font-bold text-white/95',
  };
}

type ShellNavAccent = ReturnType<typeof shellNavAccent>;

function shellNavLinkClass(active: boolean, accent: ShellNavAccent) {
  return cn(
    'group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[13px] transition-all duration-300',
    'border-inline-start-[3px]',
    active
      ? 'bg-white/5 border-[#FF6B00]'
      : cn('border-transparent', accent.labelInactive, accent.hover),
  );
}

function ShellNavRow({
  href,
  label,
  active,
  accent,
  icon: Icon,
}: {
  href: Route;
  label: string;
  active: boolean;
  accent: ShellNavAccent;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}) {
  return (
    <Link href={href} className={shellNavLinkClass(active, accent)}>
      <Icon
        className={cn('h-5 w-5 shrink-0', active ? accent.iconActive : accent.iconInactive)}
        strokeWidth={NAV_ICON_STROKE}
      />
      <span
        className={cn(
          'min-w-0 flex-1 truncate',
          active ? accent.labelActive : accent.labelInactive,
        )}
      >
        {label}
      </span>
    </Link>
  );
}

function hrefFor(
  locale: string,
  hrefKey:
    | (typeof CLIENT_NAV)[number]['hrefKey']
    | 'overview'
    | 'adminCustomers'
    | 'adminStaff'
    | 'adminStats'
    | 'adminLogs'
    | 'adminSettings',
): string {
  if (hrefKey === 'overview') return `/${locale}/overview`;
  if (hrefKey === 'adminCustomers') return `/${locale}/admin/customers`;
  if (hrefKey === 'adminStaff') return `/${locale}/admin/staff`;
  if (hrefKey === 'adminStats') return `/${locale}/admin/stats`;
  if (hrefKey === 'adminLogs') return `/${locale}/admin/logs`;
  if (hrefKey === 'adminSettings') return `/${locale}/admin/settings`;
  return `/${locale}/${hrefKey}`;
}

function isOverviewPath(pathname: string | null, locale: string): boolean {
  if (!pathname) return false;
  return (
    pathname === `/${locale}/overview` ||
    pathname === `/${locale}` ||
    pathname === `/${locale}/`
  );
}

function sovereignLinkActive(
  pathname: string | null,
  locale: string,
  hrefKey:
    | 'overview'
    | 'adminCustomers'
    | 'adminStaff'
    | 'adminStats'
    | 'adminLogs'
    | 'adminSettings',
): boolean {
  if (!pathname) return false;
  if (hrefKey === 'overview') return isOverviewPath(pathname, locale);
  if (hrefKey === 'adminCustomers') {
    return (
      pathname.startsWith(`/${locale}/admin/customers`) ||
      pathname.startsWith(`/${locale}/admin/users`)
    );
  }
  if (hrefKey === 'adminStaff') {
    return pathname.startsWith(`/${locale}/admin/staff`);
  }
  if (hrefKey === 'adminStats') {
    return pathname.startsWith(`/${locale}/admin/stats`);
  }
  if (hrefKey === 'adminLogs') {
    return pathname.startsWith(`/${locale}/admin/logs`);
  }
  if (hrefKey === 'adminSettings') {
    return pathname.startsWith(`/${locale}/admin/settings`);
  }
  return false;
}

function navCountFor(
  key: string,
  counts: { media: number; screens: number; playlists: number },
): number | null {
  if (key === 'media') return counts.media;
  if (key === 'screens') return counts.screens;
  if (key === 'playlists') return counts.playlists;
  return null;
}

export type ShellSidebarProps = {
  navLocale: 'ar' | 'en';
  rtl: boolean;
  pathname: string | null;
  sovereign: boolean;
  shellNavLoading: boolean;
  workspaceId: string | null;
  counts: { media: number; screens: number; playlists: number };
  isLoading: boolean;
  isAuthenticated: boolean;
  mobileNavOpen: boolean;
  showWorkspaceSwitcher: boolean;
};

export function ShellSidebar({
  navLocale,
  rtl,
  pathname,
  sovereign,
  shellNavLoading,
  workspaceId,
  counts,
  isLoading,
  isAuthenticated,
  mobileNavOpen,
  showWorkspaceSwitcher,
}: ShellSidebarProps) {
  const t = useTranslations('nav');
  const tUser = useTranslations('userMenu');
  const accent = shellNavAccent();
  const router = useRouter();
  const pathnameActive = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [accountOpen, setAccountOpen] = React.useState(false);
  const isDark = resolvedTheme !== 'light';

  return (
    <aside
      key={`sidebar-${navLocale}-${sovereign ? 'admin' : 'workspace'}`}
      className={cn(
        'fixed inset-y-0 z-[82] flex w-[240px] flex-col p-3 transition-transform duration-300 [inset-inline-start:0]',
        rtl
          ? mobileNavOpen
            ? 'max-lg:translate-x-0'
            : 'max-lg:translate-x-full'
          : mobileNavOpen
            ? 'max-lg:translate-x-0'
            : 'max-lg:-translate-x-full',
        'lg:translate-x-0',
      )}
    >
      <div
        className={cn(
          'relative isolate flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-2xl',
          'border-inline-end border-white/10',
          'shadow-[0_24px_56px_-24px_rgba(0,0,0,0.35)]',
        )}
      >
        {/* Navy → orange crystal glass (brand gradient) */}
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-[#1B254B]/[0.93] via-[#1B254B]/55 to-[#FF6B00]/22"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl backdrop-blur-[30px]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/[0.09]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[42%] rounded-t-2xl bg-gradient-to-b from-white/[0.07] to-transparent"
          aria-hidden
        />
        <div
          className={cn(
            'relative z-[1] flex w-full shrink-0 items-center justify-center border-b border-white/10 px-3 py-3',
          )}
        >
          <div className="flex w-full items-center justify-center rounded-xl bg-white/[0.12] p-2.5 ring-1 ring-inset ring-white/10">
            <ShellLogo locale={navLocale} />
          </div>
        </div>
        <nav
          key={navLocale}
          className={cn(
            'vc-scrollbar relative z-[1] flex flex-1 flex-col gap-0.5 overflow-y-auto px-2.5 py-4',
            rtl ? 'text-right' : 'text-left',
          )}
        >
          {shellNavLoading ? (
            <div className="flex flex-1 flex-col gap-2 px-1" aria-hidden>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-2xl bg-white/20" />
              ))}
            </div>
          ) : sovereign ? (
            <>
              <ShellNavRow
                href={hrefFor(navLocale, 'overview') as Route}
                label={t('overview')}
                active={sovereignLinkActive(pathname, navLocale, 'overview')}
                accent={accent}
                icon={LayoutDashboard}
              />

              <p
                className={cn(
                  'px-3 pb-1 pt-6 text-[10px] uppercase tracking-[0.2em]',
                  accent.section,
                )}
              >
                {t('customersSection')}
              </p>
              <ShellNavRow
                href={hrefFor(navLocale, 'adminCustomers') as Route}
                label={t('adminCustomers')}
                active={sovereignLinkActive(pathname, navLocale, 'adminCustomers')}
                accent={accent}
                icon={Users}
              />

              <p
                className={cn(
                  'px-3 pb-1 pt-5 text-[10px] uppercase tracking-[0.2em]',
                  accent.section,
                )}
              >
                {t('staffSection')}
              </p>
              <ShellNavRow
                href={hrefFor(navLocale, 'adminStaff') as Route}
                label={t('adminStaff')}
                active={sovereignLinkActive(pathname, navLocale, 'adminStaff')}
                accent={accent}
                icon={UserCog}
              />
              <ShellNavRow
                href={hrefFor(navLocale, 'adminStats') as Route}
                label={t('adminStats')}
                active={sovereignLinkActive(pathname, navLocale, 'adminStats')}
                accent={accent}
                icon={Activity}
              />
              <ShellNavRow
                href={hrefFor(navLocale, 'adminLogs') as Route}
                label={t('adminLogs')}
                active={sovereignLinkActive(pathname, navLocale, 'adminLogs')}
                accent={accent}
                icon={ScrollText}
              />
              <ShellNavRow
                href={hrefFor(navLocale, 'adminSettings') as Route}
                label={t('adminSettings')}
                active={sovereignLinkActive(pathname, navLocale, 'adminSettings')}
                accent={accent}
                icon={Settings}
              />
            </>
          ) : (
            <>
              {CLIENT_NAV.map((item) => {
                const href = hrefFor(navLocale, item.hrefKey);
                const active =
                  item.hrefKey === 'overview'
                    ? isOverviewPath(pathname, navLocale)
                    : Boolean(pathname?.startsWith(`/${navLocale}/${item.hrefKey}`));
                const Icon = item.icon;
                const count = workspaceId ? navCountFor(item.key, counts) : null;
                return (
                  <Link
                    key={item.key}
                    href={href as Route}
                    onClick={(e) => {
                      if (isLoading) {
                        e.preventDefault();
                        return;
                      }
                      if (
                        isAuthenticated &&
                        !workspaceId &&
                        item.hrefKey !== 'overview'
                      ) {
                        e.preventDefault();
                        toast.error(t('selectWorkspaceToast'));
                      }
                    }}
                    className={shellNavLinkClass(active, accent)}
                  >
                    <Icon
                      className={cn('h-5 w-5 shrink-0', active ? accent.iconActive : accent.iconInactive)}
                      strokeWidth={NAV_ICON_STROKE}
                    />
                    <span
                      className={cn(
                        'min-w-0 flex-1 truncate',
                        active ? accent.labelActive : accent.labelInactive,
                      )}
                    >
                      {t(item.key)}
                    </span>
                    {count !== null && count > 0 ? (
                      <span
                        className={cn(
                          'min-w-[1.5rem] rounded-md px-1.5 py-0.5 text-center text-[10px] font-semibold tabular-nums',
                          'bg-white/20 text-white ring-1 ring-inset ring-white/35',
                        )}
                      >
                        {count}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
              <p
                className={cn(
                  'px-3 pb-1 pt-6 text-[10px] uppercase tracking-[0.2em]',
                  accent.section,
                )}
              >
                {t('accountSection')}
              </p>
              <ShellNavRow
                href={`/${navLocale}/settings/profile` as Route}
                label={t('profileSettings')}
                active={Boolean(pathname?.startsWith(`/${navLocale}/settings/profile`))}
                accent={accent}
                icon={Settings}
              />
              <ShellNavRow
                href={`/${navLocale}/settings/billing` as Route}
                label={t('billing')}
                active={Boolean(pathname?.startsWith(`/${navLocale}/settings/billing`))}
                accent={accent}
                icon={CreditCard}
              />
            </>
          )}
        </nav>

        {/* Mobile/tablet account controls moved from header to sidebar end */}
        <div className="relative z-[2] mt-auto border-t border-white/10 p-2.5 lg:hidden">
          <div className="flex flex-col gap-2 rounded-xl bg-white/[0.06] p-2 ring-1 ring-inset ring-white/10">
            {showWorkspaceSwitcher ? <WorkspaceSwitcher /> : null}
            <button
              type="button"
              onClick={() => setAccountOpen((prev) => !prev)}
              className={cn(
                shellNavLinkClass(accountOpen, accent),
                'border border-[#FF6B00]/55 bg-[#FF6B00]/[0.08] hover:bg-[#FF6B00]/[0.14]',
              )}
              aria-expanded={accountOpen}
              aria-label={tUser('accountMenu')}
            >
              <UserRound className="h-5 w-5 shrink-0 text-[#FF6B00]" strokeWidth={NAV_ICON_STROKE} />
              <span className="min-w-0 flex-1 truncate font-semibold text-white">{t('accountSection')}</span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 shrink-0 text-[#FFB37A] transition-transform duration-200',
                  accountOpen && 'rotate-180',
                )}
                strokeWidth={ICON_STROKE}
              />
            </button>

            <div
              className={cn(
                'overflow-hidden transition-all duration-300',
                accountOpen ? 'max-h-[420px] opacity-100' : 'max-h-0 opacity-0',
              )}
            >
              <div className="mt-1 space-y-1.5 ps-2">
                <div className="flex items-center justify-between rounded-xl border border-white/15 bg-white/[0.04] px-2 py-1.5">
                  <span className="text-[11px] font-semibold text-white/85">{tUser('language')}</span>
                  <div className="inline-flex rounded-full border border-[#FF6B00]/35 bg-[#FF6B00]/[0.08] p-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        router.replace(pathWithLocale(pathnameActive, 'ar') as Route);
                        router.refresh();
                      }}
                      className={cn(
                        'rounded-full px-2.5 py-1 text-[11px] font-bold transition-all',
                        navLocale === 'ar'
                          ? 'bg-[#FF6B00]/30 text-white'
                          : 'text-white/75 hover:text-white',
                      )}
                    >
                      {tUser('langArabic')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        router.replace(pathWithLocale(pathnameActive, 'en') as Route);
                        router.refresh();
                      }}
                      className={cn(
                        'rounded-full px-2.5 py-1 text-[11px] font-bold transition-all',
                        navLocale === 'en'
                          ? 'bg-[#FF6B00]/30 text-white'
                          : 'text-white/75 hover:text-white',
                      )}
                    >
                      {tUser('langEnglish')}
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setTheme(isDark ? 'light' : 'dark')}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-[13px] text-white/95 transition-colors',
                    'hover:bg-white/10',
                  )}
                >
                  {isDark ? (
                    <Moon className="h-4 w-4 text-[#FF6B00]" strokeWidth={ICON_STROKE} />
                  ) : (
                    <Sun className="h-4 w-4 text-[#FF6B00]" strokeWidth={ICON_STROKE} />
                  )}
                  <span>{isDark ? tUser('switchToLight') : tUser('switchToDark')}</span>
                </button>

                <Link
                  href={`/${navLocale}/settings/profile` as Route}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-[13px] text-white/95 transition-colors',
                    'hover:bg-white/10',
                  )}
                >
                  <UserRound className="h-4 w-4 text-[#FF6B00]" strokeWidth={ICON_STROKE} />
                  <span>{tUser('profile')}</span>
                </Link>

                <Link
                  href={`/${navLocale}/settings/billing` as Route}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-[13px] text-white/95 transition-colors',
                    'hover:bg-white/10',
                  )}
                >
                  <SlidersHorizontal className="h-4 w-4 text-[#FF6B00]" strokeWidth={ICON_STROKE} />
                  <span>{tUser('settingsBilling')}</span>
                </Link>

                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-[13px] text-red-300 transition-colors',
                    'hover:bg-red-500/10',
                  )}
                  onClick={async () => {
                    const res = await apiFetch('/auth/logout', { method: 'POST', body: '{}' });
                    if (!res.ok) {
                      toast.error(tUser('signOutFailed'));
                      return;
                    }
                    setStoredAccessToken(null);
                    router.push(`/${navLocale}/login`);
                    router.refresh();
                  }}
                >
                  <LogOut className="h-4 w-4" strokeWidth={ICON_STROKE} />
                  <span>{tUser('signOut')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
