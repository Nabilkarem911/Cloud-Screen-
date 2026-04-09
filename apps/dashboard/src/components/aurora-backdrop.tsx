/**
 * Fixed “Aurora” atmosphere: soft orange blur orbs over navy (dark) or cool grey (light).
 * Sits at z-0; all chrome/content must stay above with relative z-index.
 */
export function AuroraBackdrop() {
  return (
    <div className="vc-aurora" aria-hidden>
      <div className="vc-aurora-orb vc-aurora-orb-a" />
      <div className="vc-aurora-orb vc-aurora-orb-b" />
      <div className="vc-aurora-orb vc-aurora-orb-c" />
    </div>
  );
}
