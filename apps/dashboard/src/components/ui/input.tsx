import * as React from 'react';
import { cn } from '@/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-11 w-full rounded-2xl border border-border bg-card px-4 py-2 text-[15px] text-foreground outline-none transition placeholder:text-muted-foreground/80 focus:border-primary/40 focus:ring-4 focus:ring-primary/10 dark:focus:ring-primary/15',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
