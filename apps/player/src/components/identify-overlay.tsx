'use client';

import { motion } from 'framer-motion';

type Props = {
  serialNumber: string;
};

export function IdentifyOverlay({ serialNumber }: Props) {
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-[200] flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 40%, rgba(0, 212, 255, 0.35) 0%, transparent 55%), radial-gradient(ellipse at 30% 70%, rgba(255, 0, 170, 0.25) 0%, transparent 50%), rgba(3, 7, 18, 0.92)',
        }}
      />
      <motion.div
        className="relative px-10 py-8 text-center"
        animate={{
          textShadow: [
            '0 0 20px rgba(0, 212, 255, 0.9), 0 0 60px rgba(255, 0, 170, 0.5)',
            '0 0 32px rgba(255, 0, 170, 0.95), 0 0 80px rgba(0, 212, 255, 0.45)',
            '0 0 20px rgba(0, 212, 255, 0.9), 0 0 60px rgba(255, 0, 170, 0.5)',
          ],
        }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-cyan-200/80">
          Screen identify
        </p>
        <p className="mt-4 font-mono text-4xl font-semibold tracking-[0.12em] text-white md:text-6xl">
          {serialNumber}
        </p>
      </motion.div>
    </motion.div>
  );
}
