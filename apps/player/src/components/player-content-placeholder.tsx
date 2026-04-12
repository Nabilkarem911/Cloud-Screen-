'use client';

type Props = {
  workspaceName: string | null | undefined;
  /** True when a playlist is selected but has no items (or all skipped). */
  hasPlaylistSelected: boolean;
};

/**
 * Shown when there is nothing to play: no playback playlist, empty playlist, or optional logo via env.
 */
export function PlayerContentPlaceholder({ workspaceName, hasPlaylistSelected }: Props) {
  const logoUrl = process.env.NEXT_PUBLIC_PLAYER_PLACEHOLDER_LOGO?.trim();

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 bg-gradient-to-b from-[#030712] via-[#0a1020] to-black px-8 text-center">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="h-16 w-auto max-w-[220px] object-contain opacity-90" />
      ) : (
        <div
          className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_0_40px_rgba(255,107,0,0.12)]"
          aria-hidden
        >
          <svg viewBox="0 0 48 48" className="h-10 w-10 text-[#FF6B00]">
            <path
              fill="currentColor"
              d="M24 6 8 14v12c0 10 8 18 16 18s16-8 16-18V14L24 6zm0 4.5L36 15.8v10.2c0 7.2-5.4 13.5-12 13.5S12 33.2 12 26V15.8L24 10.5z"
            />
          </svg>
        </div>
      )}
      <div className="space-y-2">
        <h1 className="font-mono text-lg tracking-[0.18em] text-white/90">Waiting for content</h1>
        {workspaceName ? (
          <p className="text-sm font-medium text-white/55">{workspaceName}</p>
        ) : null}
        <p className="max-w-md text-pretty font-mono text-xs leading-relaxed text-white/40">
          {hasPlaylistSelected
            ? 'This playlist has no playable items yet. Add media or canvas slides in the dashboard.'
            : 'Assign a playback playlist to this screen in the dashboard to start programming.'}
        </p>
      </div>
    </div>
  );
}
