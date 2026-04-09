'use client';

import { NextIntlClientProvider } from 'next-intl';
import { getLocaleAwareFallbackString } from '@/i18n/fallback';

type Props = {
  children: React.ReactNode;
  locale: string;
  messages: Record<string, unknown>;
};

/**
 * Prevent runtime crashes from missing translation keys on the client.
 * Falls back to English dictionary or `[namespace.key]`.
 */
export function IntlErrorHandlingProvider({ children, locale, messages }: Props) {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      onError={(error) => {
        // Keep UI resilient in production; only log in development.
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.error('[i18n]', error);
        }
      }}
      getMessageFallback={({ namespace, key }) =>
        getLocaleAwareFallbackString(locale, namespace, key)
      }
    >
      {children}
    </NextIntlClientProvider>
  );
}
