'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Languages } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ICON_STROKE } from '@/lib/icon-stroke';
import { cn } from '@/lib/utils';

export function pathWithLocale(pathname: string | null, targetLocale: 'ar' | 'en'): string {
  if (!pathname || pathname === '/') return `/${targetLocale}`;
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] === 'ar' || parts[0] === 'en') {
    parts[0] = targetLocale;
    return `/${parts.join('/')}`;
  }
  return `/${targetLocale}/${parts.join('/')}`;
}

type Props = {
  className?: string;
  compact?: boolean;
};

export function LanguageSwitcher({ className, compact = false }: Props) {
  const pathname = usePathname();
  const activeLocale = useLocale();
  const t = useTranslations('userMenu');
  const hrefAr = pathWithLocale(pathname, 'ar') as Route;
  const hrefEn = pathWithLocale(pathname, 'en') as Route;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-9 items-center gap-1.5 rounded-full border border-[#FF6B00]/30 bg-white/50 px-2 text-[11px] font-semibold uppercase tracking-wide text-[#FF6B00] shadow-[0_4px_20px_-4px_rgba(255,107,0,0.12)] backdrop-blur-md transition hover:border-[#FF6B00]/45 hover:bg-white/70 dark:border-[#FF6B00]/35 dark:bg-[#FF6B00]/[0.07] dark:hover:bg-[#FF6B00]/12',
            className,
          )}
        >
          <Languages className="h-5 w-5 opacity-90" strokeWidth={ICON_STROKE} aria-hidden />
          <span className={cn(compact ? 'hidden sm:inline' : 'inline')}>
            {activeLocale === 'ar' ? t('langArabic') : t('langEnglish')}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[9rem] rounded-2xl border-white/10 bg-card/95 backdrop-blur-xl">
        <DropdownMenuItem asChild className="rounded-xl">
          <Link href={hrefAr} className="cursor-pointer font-medium">
            {t('langArabic')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="rounded-xl">
          <Link href={hrefEn} className="cursor-pointer font-medium">
            {t('langEnglish')}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
