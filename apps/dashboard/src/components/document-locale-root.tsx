'use client';

import * as React from 'react';

/**
 * Syncs `<html lang dir>` from the active route locale — single source of truth for direction.
 * Prevents nested components from inferring orientation incorrectly.
 */
export function DocumentLocaleRoot({ locale }: { locale: string }) {
  React.useLayoutEffect(() => {
    const dir = locale === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale]);

  return null;
}
