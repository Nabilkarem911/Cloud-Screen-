import { BranchDetailClient } from '@/features/branches/branch-detail-client';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function BranchPage({ params }: Props) {
  const { locale } = await params;
  return (
    <main>
      <BranchDetailClient locale={locale} />
    </main>
  );
}
