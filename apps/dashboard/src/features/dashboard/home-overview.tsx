'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { ClientHomeDashboard } from '@/features/dashboard/client-home-dashboard';

type Props = {
  appTitle: string;
  headline: string;
  description: string;
};

export function HomeOverview({ appTitle, headline, description }: Props) {
  const t = useTranslations('homeOverview');
  return (
    <main className="space-y-12">
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="vc-glass vc-card-surface vc-surface-elevated overflow-hidden rounded-3xl"
      >
        <div className="border-b border-border/60 bg-gradient-to-r from-[#0F1729]/12 via-transparent to-[#FF6B00]/10 px-8 py-10 sm:px-10 sm:py-12 dark:border-white/[0.06]">
          <p className="vc-page-kicker">{t('kicker')}</p>
          <h1 className="vc-page-title mt-2 max-w-3xl dark:text-white">{headline}</h1>
          <p className="vc-page-desc mt-4 max-w-2xl dark:text-white/65">{description}</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Badge variant="online" className="rounded-full px-4 py-1.5 text-xs normal-case">
              {appTitle}
            </Badge>
            <span className="text-sm text-muted-foreground">{t('tagline')}</span>
          </div>
        </div>
      </motion.section>

      <ClientHomeDashboard />
    </main>
  );
}
