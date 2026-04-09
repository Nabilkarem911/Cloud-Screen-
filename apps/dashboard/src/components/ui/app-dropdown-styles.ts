import { cn } from '@/lib/utils';

/** Shared visual tokens for dropdown triggers (workspace switcher, filters, etc.) */
export const appDropdownTriggerClass = cn(
  'flex h-10 min-h-10 w-full max-w-[min(100%,280px)] items-center gap-2 rounded-2xl border px-2.5 shadow-sm backdrop-blur-xl transition-colors',
  'border-[#1B254B]/25 bg-white/45 dark:border-[#FF6B00]/20 dark:bg-[#1B254B]/25',
  'text-start outline-none ring-offset-background',
  'hover:border-[#FF6B00]/35 focus-visible:ring-2 focus-visible:ring-[#FF6B00]/40 focus-visible:ring-offset-2',
  'data-[state=open]:border-[#FF6B00]/45 data-[state=open]:shadow-[0_0_24px_-8px_rgba(255,107,0,0.35)]',
  'disabled:cursor-not-allowed disabled:opacity-50',
);

export const appDropdownContentClass = cn(
  'min-w-[260px] max-w-[min(100vw-2rem,340px)] rounded-2xl border border-white/10 p-1.5 shadow-xl',
  'bg-card/95 backdrop-blur-xl dark:bg-[#1B254B]/95',
);
