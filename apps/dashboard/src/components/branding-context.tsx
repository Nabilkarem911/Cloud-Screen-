'use client';

import * as React from 'react';
import { getApiBaseUrl } from '@/features/auth/session';

export type BrandingState = {
  platformName: string;
  brandingEpoch: number;
  logoUrlEn: string;
  logoUrlAr: string;
  hasAssetEnLight: boolean;
  hasAssetEnDark: boolean;
  hasAssetArLight: boolean;
  hasAssetArDark: boolean;
};

const defaultBranding: BrandingState = {
  platformName: 'Cloud Signage',
  brandingEpoch: 0,
  logoUrlEn: '',
  logoUrlAr: '',
  hasAssetEnLight: false,
  hasAssetEnDark: false,
  hasAssetArLight: false,
  hasAssetArDark: false,
};

const BrandingContext = React.createContext<BrandingState>(defaultBranding);

export function useBranding(): BrandingState {
  return React.useContext(BrandingContext);
}

/** Static public fallback: `/branding/logo-{locale}-{light|dark}.svg` */
export function resolveStaticBrandingLogoPath(locale: 'ar' | 'en', isDark: boolean): string {
  const theme = isDark ? 'dark' : 'light';
  return `/branding/logo-${locale}-${theme}.svg`;
}

/** Picks uploaded asset URL, then legacy external URLs. */
export function resolveSidebarLogoSrc(
  branding: BrandingState,
  pathLocale: 'ar' | 'en',
  isDark: boolean,
): string | null {
  const base = getApiBaseUrl();
  const v = branding.brandingEpoch ?? 0;
  const file = (variant: string) =>
    `${base}/branding/file/${variant}?v=${encodeURIComponent(String(v))}`;

  if (pathLocale === 'ar') {
    if (isDark) {
      if (branding.hasAssetArDark) return file('ar-dark');
      if (branding.hasAssetArLight) return file('ar-light');
    } else {
      if (branding.hasAssetArLight) return file('ar-light');
      if (branding.hasAssetArDark) return file('ar-dark');
    }
    const leg = branding.logoUrlAr?.trim() || branding.logoUrlEn?.trim();
    return leg || null;
  }

  if (isDark) {
    if (branding.hasAssetEnDark) return file('en-dark');
    if (branding.hasAssetEnLight) return file('en-light');
  } else {
    if (branding.hasAssetEnLight) return file('en-light');
    if (branding.hasAssetEnDark) return file('en-dark');
  }
  const leg = branding.logoUrlEn?.trim() || branding.logoUrlAr?.trim();
  return leg || null;
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = React.useState<BrandingState>(defaultBranding);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/branding`, {
          method: 'GET',
          credentials: 'omit',
        });
        if (!res.ok) return;
        const data = (await res.json()) as Partial<BrandingState>;
        if (cancelled) return;
        setBranding({
          platformName:
            typeof data.platformName === 'string'
              ? data.platformName
              : defaultBranding.platformName,
          brandingEpoch:
            typeof data.brandingEpoch === 'number' && Number.isFinite(data.brandingEpoch)
              ? data.brandingEpoch
              : 0,
          logoUrlEn: typeof data.logoUrlEn === 'string' ? data.logoUrlEn : '',
          logoUrlAr: typeof data.logoUrlAr === 'string' ? data.logoUrlAr : '',
          hasAssetEnLight: Boolean(data.hasAssetEnLight),
          hasAssetEnDark: Boolean(data.hasAssetEnDark),
          hasAssetArLight: Boolean(data.hasAssetArLight),
          hasAssetArDark: Boolean(data.hasAssetArDark),
        });
      } catch {
        /* keep defaults */
      }
    };
    void load();
    const onRefresh = () => void load();
    window.addEventListener('branding-updated', onRefresh);
    return () => {
      cancelled = true;
      window.removeEventListener('branding-updated', onRefresh);
    };
  }, []);

  return (
    <BrandingContext.Provider value={branding}>{children}</BrandingContext.Provider>
  );
}
