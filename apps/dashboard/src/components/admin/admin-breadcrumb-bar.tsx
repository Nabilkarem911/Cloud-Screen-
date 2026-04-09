'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useLocale } from 'next-intl';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AdminBreadcrumbItem = {
  label: string;
  href?: string;
};

type Props = {
  items: AdminBreadcrumbItem[];
  ariaLabel: string;
};

export function AdminBreadcrumbBar({ items, ariaLabel }: Props) {
  const locale = useLocale();
  const rtl = locale === 'ar';

  return (
    <nav
      aria-label={ariaLabel}
      className="mb-5 flex flex-wrap items-center gap-x-1 gap-y-1 text-[12px] text-muted-foreground"
    >
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="inline-flex items-center gap-1">
          {i > 0 ? (
            <ChevronRight
              className={cn(
                'h-3.5 w-3.5 shrink-0 text-[#FF6B00]/45',
                rtl && 'rotate-180',
              )}
              aria-hidden
            />
          ) : null}
          {item.href ? (
            <Link
              href={item.href as Route}
              className="rounded-md text-[#94A3B8] transition-colors hover:text-[#FF6B00] hover:underline"
            >
              {item.label}
            </Link>
          ) : (
            <span className="font-medium text-foreground">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
