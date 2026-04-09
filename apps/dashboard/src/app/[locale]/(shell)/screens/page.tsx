import { ScreensClient } from '@/features/screens/screens-client';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ScreensPage({ params }: Props) {
  const { locale } = await params;

  return (
    <main>
      <ScreensClient locale={locale} />
    </main>
  );
}
