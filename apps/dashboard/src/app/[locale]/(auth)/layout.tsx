import { AuroraBackdrop } from '@/components/aurora-backdrop';

/**
 * Auth routes: fixed navy→black base + Aurora orbs + content (matches login reference).
 */
export default function AuthGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen">
      <div
        className="fixed inset-0 z-0 bg-gradient-to-b from-[#1B254B] via-[#121a38] to-[#020305]"
        aria-hidden
      />
      <AuroraBackdrop />
      <div className="relative z-[1] min-h-screen">{children}</div>
    </div>
  );
}
