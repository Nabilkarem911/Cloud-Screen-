import type { Config } from 'tailwindcss';

/**
 * Brand tokens mirror `globals.css` @theme (`--color-brand-orange`, `--color-brand-navy`).
 * Kept for tooling / editor hints and any legacy `@config` usage.
 */
export default {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: '#FF6B00',
          navy: '#1B254B',
        },
      },
    },
  },
} satisfies Config;
