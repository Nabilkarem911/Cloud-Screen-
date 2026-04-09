'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import {
  resolveSidebarLogoSrc,
  resolveStaticBrandingLogoPath,
  useBranding,
} from '@/components/branding-context';
import { cn } from '@/lib/utils';

type Props = {
  locale: 'ar' | 'en';
  className?: string;
};

/**
 * 4-tier branding: API assets (en-light / en-dark / ar-light / ar-dark) then
 * `public/branding/logo-{locale}-{light|dark}.svg`.
 */
export function ShellLogo({ locale, className }: Props) {
  const branding = useBranding();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';
  const apiSrc = resolveSidebarLogoSrc(branding, locale, isDark);
  const staticSrc = resolveStaticBrandingLogoPath(locale, isDark);
  const [src, setSrc] = React.useState<string | null>(apiSrc ?? staticSrc);

  React.useEffect(() => {
    setSrc(apiSrc ?? staticSrc);
  }, [apiSrc, staticSrc, branding.brandingEpoch]);

  if (!src) {
    return <div className={cn('h-8 w-full min-h-0 bg-transparent', className)} aria-hidden />;
  }

  return (
    <img
      src={src}
      alt=""
      className={cn('max-h-[40px] w-auto max-w-[200px] object-contain object-center', className)}
      onError={() => setSrc((prev) => (prev === staticSrc ? null : staticSrc))}
    />
  );
}
