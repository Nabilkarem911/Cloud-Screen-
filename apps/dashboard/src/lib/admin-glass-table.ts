/** Admin tables — minimalist glass, orange accent */
export const adminGlassTable = {
  wrap:
    'vc-card-surface overflow-hidden rounded-2xl border border-black/[0.05] bg-card/50 backdrop-blur-xl dark:border-white/[0.05] dark:bg-[rgb(12_18_32_/0.72)]',
  theadRow:
    'border-0 bg-muted/25 hover:bg-muted/25 dark:bg-[#0c1220]/90 dark:hover:bg-[#0c1220]/90',
  th: 'h-11 align-middle font-semibold text-[11px] uppercase tracking-[0.1em] text-[#FF6B00] dark:text-[#FF6B00]/90',
  tbodyRow:
    'border-black/[0.05] transition-colors duration-150 hover:bg-muted/30 data-[state=selected]:bg-muted/40 dark:border-white/[0.05] dark:hover:bg-white/[0.04]',
  tbodyRowClickable:
    'border-black/[0.05] cursor-pointer transition-colors duration-150 hover:bg-muted/35 dark:border-white/[0.05] dark:hover:bg-white/[0.05]',
  statusCell: 'align-middle',
  statusInner: 'flex justify-center',
} as const;
