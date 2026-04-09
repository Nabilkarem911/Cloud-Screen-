'use client';

import { Toaster } from 'sonner';
import { useTheme } from 'next-themes';

export function AppToaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      richColors
      expand
      closeButton
      position="top-right"
      theme={resolvedTheme === 'light' ? 'light' : 'dark'}
      toastOptions={{
        classNames: {
          toast:
            'border border-border/80 bg-card/95 backdrop-blur-xl shadow-[0_12px_40px_-12px_rgba(255,107,0,0.12)] dark:shadow-[0_16px_48px_-12px_rgba(0,0,0,0.5)]',
        },
      }}
    />
  );
}
