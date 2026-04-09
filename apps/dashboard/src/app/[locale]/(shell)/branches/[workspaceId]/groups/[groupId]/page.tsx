import { redirect } from 'next/navigation';

type Props = {
  params: Promise<{ locale: string; workspaceId: string; groupId: string }>;
};

/** Legacy URL: groups were unified with playlists. */
export default async function LegacyGroupToPlaylistRedirect({ params }: Props) {
  const { locale, workspaceId, groupId } = await params;
  redirect(`/${locale}/branches/${workspaceId}/playlists/${groupId}`);
}
