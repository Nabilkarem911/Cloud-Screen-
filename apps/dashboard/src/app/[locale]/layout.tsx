import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { AppToaster } from '@/components/app-toaster';
import { DocumentLocaleRoot } from '@/components/document-locale-root';
import { IntlErrorHandlingProvider } from '@/components/intl-error-handling-provider';
import { WorkspaceProvider } from '@/features/workspace/workspace-context';
import { routing } from '@/i18n/routing';

export const metadata: Metadata = {
  title: 'Cloud Signage Dashboard',
  description: 'Premium, enterprise control center for digital signage',
};
export const dynamic = 'force-dynamic';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: LayoutProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  setRequestLocale(locale);
  const messages = (await import(`@/i18n/messages/${locale}.json`)).default;
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <div
      lang={locale}
      dir={dir}
      className={`min-h-screen ${locale === 'ar' ? 'font-ar' : ''}`}
    >
      <DocumentLocaleRoot locale={locale} />
      <IntlErrorHandlingProvider locale={locale} messages={messages as Record<string, unknown>}>
        <WorkspaceProvider>
          {children}
          <AppToaster />
        </WorkspaceProvider>
      </IntlErrorHandlingProvider>
    </div>
  );
}
