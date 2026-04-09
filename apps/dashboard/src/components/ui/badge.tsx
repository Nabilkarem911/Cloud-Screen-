import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide transition-colors',
  {
    variants: {
      variant: {
        default:
          'border-primary/25 bg-primary/10 text-primary dark:bg-primary/15 dark:text-primary',
        muted: 'border-border bg-muted text-muted-foreground',
        success:
          'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
        /** Online / live — orange accent */
        online:
          'border-[#FF6B00]/45 bg-[#FF6B00]/15 text-[#9a3412] shadow-sm shadow-[#FF6B00]/20 dark:text-[#FFBB88]',
        warning:
          'border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-200',
        danger: 'border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
