'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  icon: LucideIcon;
  title: string;
  description?: string;
  className?: string;
};

export function AdminEmptyState({ icon: Icon, title, description, className }: Props) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-14 text-center',
        className,
      )}
    >
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#FF6B00]/25 bg-gradient-to-br from-[#FF6B00]/15 to-amber-600/10 shadow-[0_0_32px_-8px_rgba(255, 107, 0,0.35)]">
        <Icon className="h-8 w-8 text-[#94A3B8] dark:text-[#FF6B00]" strokeWidth={1.75} aria-hidden />
      </span>
      <p className="max-w-sm text-base font-semibold text-foreground">{title}</p>
      {description ? (
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
