import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { routing } from '@/i18n/routing';

function detectPreferredLocale(acceptLanguage: string | null): 'ar' | 'en' {
  if (!acceptLanguage) return routing.defaultLocale as 'ar' | 'en';
  const normalized = acceptLanguage.toLowerCase();
  if (normalized.includes('ar')) return 'ar';
  if (normalized.includes('en')) return 'en';
  return routing.defaultLocale as 'ar' | 'en';
}

export default async function Home() {
  const cookieStore = await cookies();
  const stored = cookieStore.get('NEXT_LOCALE')?.value;
  if (stored === 'ar' || stored === 'en') {
    redirect(`/${stored}`);
  }

  const requestHeaders = await headers();
  const fromHeader = detectPreferredLocale(requestHeaders.get('accept-language'));
  redirect(`/${fromHeader}`);
}
