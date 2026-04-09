import { BrandingProvider } from '@/components/branding-context';
import { CrystalShell } from '@/components/crystal-shell';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function ShellLayout({ children, params }: Props) {
  const { locale } = await params;

  return (
    <BrandingProvider>
      <CrystalShell locale={locale}>
        {children}
      </CrystalShell>
    </BrandingProvider>
  );
}
