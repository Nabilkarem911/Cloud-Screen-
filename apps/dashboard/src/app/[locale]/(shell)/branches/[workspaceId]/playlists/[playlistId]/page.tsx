import { PlaylistScreensClient } from '@/features/branches/playlist-screens-client';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function BranchPlaylistScreensPage({ params }: Props) {
  const { locale } = await params;
  return (
    <main>
      <PlaylistScreensClient locale={locale} />
    </main>
  );
}
