import { Suspense } from 'react';
import { MediaLibraryClient } from '@/features/media/media-library-client';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function MediaPage({ params }: Props) {
  await params;

  return (
    <main className="space-y-10">
      <Suspense
        fallback={
          <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
            …
          </div>
        }
      >
        <MediaLibraryClient />
      </Suspense>
    </main>
  );
}
