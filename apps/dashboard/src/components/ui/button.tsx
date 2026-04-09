import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-2xl text-sm font-semibold tracking-tight transition-all disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
  {
    variants: {
      variant: {
        default: 'vc-btn-primary',
        cta: 'vc-btn-cta text-white',
        secondary:
          'border border-border bg-muted/90 text-foreground shadow-sm hover:bg-muted hover:scale-[1.02] hover:shadow-md',
        ghost:
          'text-muted-foreground hover:bg-muted/80 hover:text-foreground hover:scale-[1.02]',
        outline:
          'border-2 border-primary/25 bg-card text-primary hover:border-primary/45 hover:bg-primary/5 hover:scale-[1.02] hover:shadow-[0_0_20px_-4px_rgba(255,107,0,0.2)]',
        destructive:
          'border border-red-500/30 bg-red-600 text-white shadow-sm hover:bg-red-700 hover:scale-[1.02]',
      },
      size: {
        default: 'h-11 px-5 py-2',
        sm: 'h-9 rounded-xl px-3.5 text-xs',
        lg: 'h-12 rounded-2xl px-8 text-base',
        icon: 'h-11 w-11 rounded-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
