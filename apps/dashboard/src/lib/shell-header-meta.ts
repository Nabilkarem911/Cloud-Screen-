'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';

export type ShellHeaderMeta = {
  pageTitle: string;
  kicker: string;
  showBack: boolean;
  backHref: string | null;
  backLabel: string;
};

export function useShellHeaderMeta(pathname: string | null): ShellHeaderMeta {
  const t = useTranslations('shell');
  const activeLocale = useLocale();
  const locale = activeLocale === 'ar' || activeLocale === 'en' ? activeLocale : 'en';

  return useMemo(() => {
    const base = `/${locale}`;
    const parts = pathname?.split('/').filter(Boolean) ?? [];
    if (parts[0] !== locale) {
      return {
        pageTitle: t('pageTitles.default'),
        kicker: '',
        showBack: false,
        backHref: null,
        backLabel: '',
      };
    }

    const rest = parts.slice(1);
    const join = (segments: string[]) => `${base}/${segments.join('/')}`;

    if (
      rest[0] === 'admin' &&
      rest[1] === 'customers' &&
      rest[2] &&
      rest[3] === 'workspace' &&
      rest[4] &&
      rest.length === 5
    ) {
      return {
        pageTitle: t('pageTitles.adminCustomerBranch'),
        kicker: '',
        showBack: true,
        backHref: join(['admin', 'customers', rest[2]]),
        backLabel: t('backToCustomerProfile'),
      };
    }

    if (
      rest[0] === 'admin' &&
      rest[1] === 'customers' &&
      rest[2] &&
      rest.length === 3
    ) {
      return {
        pageTitle: t('pageTitles.adminCustomerProfile'),
        kicker: '',
        showBack: true,
        backHref: join(['admin', 'customers']),
        backLabel: t('backToCustomers'),
      };
    }

    if (rest[0] === 'branches' && rest[1] && rest[2] === 'playlists' && rest[3]) {
      return {
        pageTitle: t('pageTitles.branchPlaylist'),
        kicker: '',
        showBack: true,
        backHref: join(['branches', rest[1]]),
        backLabel: t('backToBranch'),
      };
    }

    if (rest[0] === 'branches' && rest[1] && rest.length === 2) {
      return {
        pageTitle: t('pageTitles.branchDetail'),
        kicker: '',
        showBack: true,
        backHref: `${base}/overview`,
        backLabel: t('backToOverview'),
      };
    }

    if (
      rest[0] === 'settings' &&
      (rest[1] === 'profile' || rest[1] === 'billing') &&
      rest.length === 2
    ) {
      return {
        pageTitle:
          rest[1] === 'profile'
            ? t('pageTitles.settingsProfile')
            : t('pageTitles.settingsBilling'),
        kicker: '',
        showBack: true,
        backHref: `${base}/overview`,
        backLabel: t('backToOverview'),
      };
    }

    let pageTitle = t('pageTitles.default');

    if (rest.length === 0 || rest[0] === 'overview') {
      pageTitle = t('pageTitles.overview');
    } else if (rest[0] === 'screens') {
      pageTitle = t('pageTitles.screens');
    } else if (rest[0] === 'media') {
      pageTitle = t('pageTitles.media');
    } else if (rest[0] === 'studio') {
      pageTitle = t('pageTitles.studio');
    } else if (rest[0] === 'playlists') {
      pageTitle = t('pageTitles.playlists');
    } else if (rest[0] === 'schedules') {
      pageTitle = t('pageTitles.schedules');
    } else if (rest[0] === 'team') {
      pageTitle = t('pageTitles.team');
    } else if (rest[0] === 'billing') {
      pageTitle = t('pageTitles.billing');
    } else if (rest[0] === 'settings' && rest[1] === 'profile') {
      pageTitle = t('pageTitles.settingsProfile');
    } else if (rest[0] === 'settings' && rest[1] === 'billing') {
      pageTitle = t('pageTitles.settingsBilling');
    } else if (rest[0] === 'admin' && rest[1] === 'customers') {
      pageTitle = t('pageTitles.adminCustomers');
    } else if (rest[0] === 'admin' && rest[1] === 'users') {
      pageTitle = t('pageTitles.adminUsers');
    } else if (rest[0] === 'admin' && rest[1] === 'workspaces') {
      pageTitle = t('pageTitles.adminWorkspaces');
    } else if (rest[0] === 'admin' && rest[1] === 'staff') {
      pageTitle = t('pageTitles.adminStaff');
    } else if (rest[0] === 'admin' && rest[1] === 'stats') {
      pageTitle = t('pageTitles.adminStats');
    } else if (rest[0] === 'admin' && rest[1] === 'logs') {
      pageTitle = t('pageTitles.adminLogs');
    } else if (rest[0] === 'admin' && rest[1] === 'settings') {
      pageTitle = t('pageTitles.adminSettings');
    } else if (rest[0] === 'admin' && rest[1] === 'billing') {
      pageTitle = t('pageTitles.settingsBilling');
    } else if (rest[0] === 'admin') {
      pageTitle = t('pageTitles.adminOverview');
    }

    return {
      pageTitle,
      kicker: '',
      showBack: false,
      backHref: null,
      backLabel: '',
    };
  }, [pathname, locale, t]);
}

