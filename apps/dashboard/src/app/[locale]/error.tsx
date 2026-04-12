'use client';

import { useEffect } from 'react';
import { devError } from '@/lib/dev-log';

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * Locale segment error boundary — avoids blank Internal Server Error with no recovery.
 */
export default function LocaleError({ error, reset }: Props) {
  const isArabic =
    typeof document !== 'undefined' && document.documentElement.lang.toLowerCase().startsWith('ar');
  useEffect(() => {
    devError('[locale route error]', error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <p className="text-lg font-semibold text-foreground">
        {isArabic ? 'حدث خطأ غير متوقع' : 'Something went wrong'}
      </p>
      {process.env.NODE_ENV === 'development' ? (
        <p className="max-w-lg text-sm text-muted-foreground">{error.message}</p>
      ) : null}
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-xl bg-[#FF6B00] px-4 py-2 text-sm font-semibold text-white hover:bg-[#FF6B00]/90"
      >
        {isArabic ? 'المحاولة مرة أخرى' : 'Try again'}
      </button>
    </div>
  );
}
