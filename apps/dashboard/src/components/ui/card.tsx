import * as React from 'react';
import { cn } from '@/lib/utils';

function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'vc-card-surface relative overflow-hidden text-card-foreground transition-shadow duration-300 hover:shadow-[0_12px_40px_-12px_rgba(255,107,0,0.12)] dark:hover:shadow-[0_16px_48px_-12px_rgba(255,107,0,0.15)]',
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('relative z-[1] flex flex-col space-y-2 p-7 sm:p-8', className)} {...props} />;
}

function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        'text-xl font-semibold leading-tight tracking-tight text-foreground sm:text-2xl',
        className,
      )}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-[15px] leading-relaxed text-muted-foreground', className)} {...props} />;
}

function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('relative z-[1] px-7 pb-7 pt-0 sm:px-8 sm:pb-8', className)} {...props} />;
}

function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('relative z-[1] flex items-center px-7 pb-7 pt-0 sm:px-8 sm:pb-8', className)} {...props} />;
}

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
