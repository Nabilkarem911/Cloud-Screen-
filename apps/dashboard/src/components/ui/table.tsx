import * as React from 'react';
import { cn } from '@/lib/utils';

/** Scroll wrapper only — use `vc-card-surface` or `adminGlassTable.wrap` for the card chrome. */
function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div className="relative w-full overflow-x-auto">
      <table className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead
      className={cn(
        'vc-table-head-surface [&_tr]:border-b [&_tr]:border-black/[0.06] dark:[&_tr]:border-white/[0.06]',
        className,
      )}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      className={cn(
        'vc-table-row border-b border-black/[0.05] transition-colors data-[state=selected]:bg-muted/50 dark:border-white/[0.05]',
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      className={cn(
        'h-11 px-4 py-3 text-start align-middle text-[11px] font-semibold uppercase tracking-[0.12em] text-[#FF6B00] dark:text-[#FF9F4A]',
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return (
    <td className={cn('px-4 py-3 align-middle text-[15px] text-foreground/95', className)} {...props} />
  );
}

export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow };
