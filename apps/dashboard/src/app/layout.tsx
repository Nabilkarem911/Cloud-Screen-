import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { IBM_Plex_Sans_Arabic } from 'next/font/google';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import { ThemeProvider } from '@/components/theme-provider';
import { routing } from '@/i18n/routing';
import './globals.css';

const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans-ar',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Cloud Signage',
  description: 'AI-powered cloud signage dashboard',
};

function detectPreferredLocale(acceptLanguage: string | null): 'ar' | 'en' {
  if (!acceptLanguage) return routing.defaultLocale as 'ar' | 'en';
  const normalized = acceptLanguage.toLowerCase();
  if (normalized.includes('ar')) return 'ar';
  if (normalized.includes('en')) return 'en';
  return routing.defaultLocale as 'ar' | 'en';
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const localeCookie = cookieStore.get('NEXT_LOCALE')?.value;
  const htmlLang =
    localeCookie === 'ar' || localeCookie === 'en'
      ? localeCookie
      : detectPreferredLocale(requestHeaders.get('accept-language'));

  return (
    <html
      lang={htmlLang}
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} ${ibmPlexArabic.variable}`}
    >
      <body
        className={`${GeistSans.className} min-h-screen antialiased bg-background text-foreground`}
      >
        {/* Hydration lock: set .dark from localStorage before paint to avoid theme flash */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "!function(){try{var r=document.documentElement;var k='theme';var t=localStorage.getItem(k);if(t==='light'){r.classList.remove('dark');}else{r.classList.add('dark');}}catch(e){document.documentElement.classList.add('dark');}}();",
          }}
        />
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="theme">
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
