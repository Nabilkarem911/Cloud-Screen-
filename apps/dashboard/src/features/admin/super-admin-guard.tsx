'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useWorkspace } from '@/features/workspace/workspace-context';

export function SuperAdminGuard({ children }: { children: React.ReactNode }) {
  const t = useTranslations('superAdminGuard');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { isSuperAdmin, isLoading, isAuthenticated } = useWorkspace();
  const deniedToast = useRef(false);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      const returnTo = encodeURIComponent(pathname || `/${locale}/overview`);
      router.replace(`/${locale}/login?returnTo=${returnTo}`);
      return;
    }
    if (!isSuperAdmin) {
      if (!deniedToast.current) {
        deniedToast.current = true;
        toast.error(t('accessDenied'));
      }
      router.replace(`/${locale}/overview`);
    }
  }, [isLoading, isAuthenticated, isSuperAdmin, locale, pathname, router, t]);

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-12rem)] flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-10 w-10 animate-spin text-[#FF6B00]" />
        <p className="text-sm font-medium">{t('verifying')}</p>
      </div>
    );
  }

  if (!isAuthenticated || !isSuperAdmin) {
    return (
      <div className="flex min-h-[calc(100vh-12rem)] flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-[#FF6B00]" />
      </div>
    );
  }

  return <>{children}</>;
}
