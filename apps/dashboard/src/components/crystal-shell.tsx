'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ShellHeader } from '@/components/layout/header';
import { ShellHeaderInsetSetterContext } from '@/components/layout/shell-header-inset-context';
import { ShellSidebar } from '@/components/layout/shell-sidebar';
import { PageTransition } from '@/components/page-transition';
import { ImpersonationReturnButton } from '@/features/admin/impersonation-return-button';
import { WorkspaceGate } from '@/features/workspace/workspace-gate';
import { useWorkspace } from '@/features/workspace/workspace-context';
import { useWorkspaceStats } from '@/features/workspace/use-workspace-stats';
import { useShellHeaderMeta } from '@/lib/shell-header-meta';

type CrystalShellProps = {
  children: React.ReactNode;
  locale: string;
};

export function CrystalShell({ children, locale }: CrystalShellProps) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const {
    workspaceId,
    workspaces,
    workspaceDataEpoch,
    isLoading,
    isAuthenticated,
    isSuperAdmin,
    impersonatedBySuperAdminId,
  } = useWorkspace();
  const counts = useWorkspaceStats(workspaceId, workspaceDataEpoch);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const [headerInset, setHeaderInset] = React.useState<React.ReactNode>(null);
  const setHeaderInsetStable = React.useCallback((node: React.ReactNode | null) => {
    setHeaderInset(node);
  }, []);
  const [hintSuperAdmin, setHintSuperAdmin] = React.useState(false);
  React.useLayoutEffect(() => {
    try {
      setHintSuperAdmin(sessionStorage.getItem('cs_super_admin') === '1');
    } catch {
      setHintSuperAdmin(false);
    }
  }, []);

  // Close mobile nav after route changes.
  React.useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    setHeaderInset(null);
  }, [pathname]);

  // Ensure mobile nav cannot stay open on desktop widths.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const query = window.matchMedia('(min-width: 1024px)');
    const syncDesktop = (event: MediaQueryList | MediaQueryListEvent) => {
      if (event.matches) {
        setMobileNavOpen(false);
      }
    };
    syncDesktop(query);
    const listener = (event: MediaQueryListEvent) => syncDesktop(event);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, []);

  const isImpersonating = Boolean(impersonatedBySuperAdminId);
  const pathSegment = pathname?.split('/').filter(Boolean)[0];
  const pathLocale =
    pathSegment === 'ar' || pathSegment === 'en' ? pathSegment : locale;
  const navLocale = pathLocale as 'ar' | 'en';
  const headerMeta = useShellHeaderMeta(pathname);

  const pageTitle = React.useMemo(() => {
    const parts = pathname?.split('/').filter(Boolean) ?? [];
    if (parts[0] !== navLocale) return headerMeta.pageTitle;
    if (parts[1] === 'branches' && parts[2] && !parts[3]) {
      const ws = workspaces.find((w) => w.id === parts[2]);
      if (ws?.name) return ws.name;
    }
    return headerMeta.pageTitle;
  }, [pathname, navLocale, workspaces, headerMeta.pageTitle]);

  const pathIsAdmin = Boolean(pathname?.startsWith(`/${navLocale}/admin`));
  const sovereign =
    !isImpersonating &&
    (pathIsAdmin || isSuperAdmin || (isLoading && hintSuperAdmin));

  const shellNavLoading =
    isLoading && !pathIsAdmin && !isSuperAdmin && !hintSuperAdmin;

  const rtl = navLocale === 'ar';

  return (
    <div className="relative flex h-dvh min-h-0 flex-col overflow-x-hidden overflow-y-hidden bg-background text-foreground dark:bg-transparent">
      <ShellSidebar
        navLocale={navLocale}
        rtl={rtl}
        pathname={pathname}
        sovereign={sovereign}
        shellNavLoading={shellNavLoading}
        workspaceId={workspaceId}
        counts={counts}
        isLoading={isLoading}
        isAuthenticated={isAuthenticated}
        mobileNavOpen={mobileNavOpen}
        showWorkspaceSwitcher={!sovereign}
      />

      {mobileNavOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-[78] bg-[rgba(27,37,75,0.55)] backdrop-blur-sm lg:hidden"
          onClick={() => setMobileNavOpen(false)}
          aria-label={t('toggleMenu')}
        />
      ) : null}

      {/* Main column: fixed viewport height; only <main> scrolls — sidebar stays fixed, no document scroll */}
      <div className="relative z-[20] flex min-h-0 flex-1 flex-col overflow-hidden lg:ms-[240px] lg:pl-8">
        <ShellHeader
          navLocale={navLocale}
          rtl={rtl}
          sovereign={sovereign}
          pageTitle={pageTitle}
          kicker={headerMeta.kicker}
          showBack={headerMeta.showBack}
          backHref={headerMeta.backHref}
          backLabel={headerMeta.backLabel}
          mobileNavOpen={mobileNavOpen}
          onToggleMobileNav={() => setMobileNavOpen((v) => !v)}
          showWorkspaceSwitcher={!sovereign}
          headerInset={headerInset}
        />
        <ShellHeaderInsetSetterContext.Provider value={setHeaderInsetStable}>
          <main className="vc-scrollbar relative z-[1] mx-auto min-h-0 w-full max-w-[1600px] flex-1 overflow-y-auto overscroll-y-contain px-3 py-5 sm:px-6 sm:py-8 lg:px-14 lg:py-16">
            <PageTransition>
              <WorkspaceGate>{children}</WorkspaceGate>
            </PageTransition>
          </main>
        </ShellHeaderInsetSetterContext.Provider>
        <ImpersonationReturnButton />
      </div>
    </div>
  );
}
