'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useWorkspace } from '@/features/workspace/workspace-context';
import { WorkspaceWelcome } from '@/features/workspace/workspace-welcome';

const CLIENT_ROUTE_SEGMENTS = new Set([
  'media',
  'screens',
  'studio',
  'playlists',
  'schedules',
  'team',
  'billing',
]);

export function WorkspaceGate({ children }: { children: React.ReactNode }) {
  const t = useTranslations('workspaceGate');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { isLoading, workspaces, isAuthenticated, isSuperAdmin } = useWorkspace();

  const isAuthPage =
    pathname?.includes('/login') || pathname?.includes('/register');

  useEffect(() => {
    if (!isAuthenticated || isLoading || !isSuperAdmin || !pathname) return;
    const segments = pathname.split('/').filter(Boolean);
    const routeSeg = segments[1];
    if (routeSeg && CLIENT_ROUTE_SEGMENTS.has(routeSeg)) {
      toast.info(t('impersonationHint'), {
        id: 'sovereign-client-route',
      });
      router.replace(`/${locale}/overview`);
    }
  }, [isAuthenticated, isLoading, isSuperAdmin, pathname, router, locale, t]);

  if (isAuthPage) {
    return <>{children}</>;
  }

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-12rem)] flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-10 w-10 animate-spin text-[#0F1729]" />
        <p className="text-sm font-medium">{t('loading')}</p>
      </div>
    );
  }

  if (isAuthenticated && workspaces.length === 0 && !isSuperAdmin) {
    return <WorkspaceWelcome />;
  }

  return <>{children}</>;
}
