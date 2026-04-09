import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { headers } from 'next/headers';
import { getLocaleAwareFallbackString } from './fallback';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  // When middleware fails to provide requestLocale, try to recover from headers.
  const requested = await requestLocale;
  let recoveredFromHeader: string | null = null;
  if (requested == null) {
    try {
      const h = await headers();
      recoveredFromHeader =
        h.get('x-next-intl-locale') ??
        h.get('x-locale') ??
        h.get('next-locale');
    } catch {
      recoveredFromHeader = null;
    }
  }
  const locale =
    requested != null && hasLocale(routing.locales, requested)
      ? requested
      : recoveredFromHeader != null && hasLocale(routing.locales, recoveredFromHeader)
        ? recoveredFromHeader
      : routing.defaultLocale;

  if (process.env.NODE_ENV === 'development' && requested == null) {
    // eslint-disable-next-line no-console
    console.warn('[i18n] requestLocale missing; resolved locale:', locale);
  }

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
    getMessageFallback({ namespace, key }) {
      return getLocaleAwareFallbackString(locale, namespace, key);
    },
  };
});
