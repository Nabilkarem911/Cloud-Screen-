'use client';

type Props = {
  /** Screen-reader / optional caption under the spinner */
  label?: string;
  /** When true, sits behind content (pointer-events none, z-0). */
  behind?: boolean;
  /** Fill a positioned parent instead of covering the viewport. */
  embedded?: boolean;
};

export function LoadingOverlay({
  label = 'Loading',
  behind = false,
  embedded = false,
}: Props) {
  const logoUrl = process.env.NEXT_PUBLIC_PLAYER_PLACEHOLDER_LOGO?.trim() ?? '';

  const positionClass = embedded
    ? 'absolute inset-0 z-[520] flex flex-col items-center justify-center bg-[#030712]'
    : behind
      ? 'pointer-events-none absolute inset-0 z-0 flex flex-col items-center justify-center bg-[#030712]'
      : 'fixed inset-0 z-[600] flex flex-col items-center justify-center bg-[#030712]';

  return (
    <div
      className={positionClass}
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      <div className="flex flex-col items-center gap-8 px-6">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=""
            className="max-h-24 max-w-[min(80vw,280px)] object-contain opacity-95 drop-shadow-[0_0_40px_rgba(0,212,255,0.25)]"
            draggable={false}
          />
        ) : (
          <p className="font-mono text-lg tracking-[0.25em] text-white/80">Cloud Signage</p>
        )}
        <div className="relative h-14 w-14">
          <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20" />
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-cyan-400 border-r-cyan-300/80" />
        </div>
        <p className="max-w-sm text-center font-mono text-xs tracking-[0.18em] text-white/45">
          {label}
        </p>
      </div>
    </div>
  );
}
