'use client';

import { Moon, Sun } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="h-8 w-8 shrink-0 rounded-full border-[#FF6B00]/25 bg-card/80 shadow-[0_0_16px_-6px_rgba(255,107,0,0.2)] backdrop-blur-md transition hover:scale-[1.03] hover:border-[#FF6B00]/45 hover:shadow-[0_0_22px_-4px_rgba(255,107,0,0.35)] dark:border-white/10 dark:hover:shadow-[0_0_24px_-4px_rgba(255,107,0,0.2)]"
      suppressHydrationWarning
    >
      <motion.span
        className="flex items-center justify-center"
        key={isDark ? 'dark' : 'light'}
        initial={{ scale: 0.9, rotate: -20, opacity: 0.7 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 26 }}
      >
        {isDark ? (
          <Moon className="h-5 w-5 text-primary" strokeWidth={2} />
        ) : (
          <Sun className="h-5 w-5 text-[#FF6B00]" strokeWidth={2} />
        )}
      </motion.span>
    </Button>
  );
}
