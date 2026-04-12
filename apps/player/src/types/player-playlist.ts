export type PlaylistMedia = {
  id: string;
  mimeType: string;
  publicUrl: string;
};

export type PlaylistCanvasCompiled = {
  id: string;
  name: string;
  width: number;
  height: number;
  durationSec: number;
  layoutData: unknown;
};

export type PlaylistMediaItem = {
  kind: 'media';
  orderIndex: number;
  durationSec: number;
  media: PlaylistMedia;
};

export type PlaylistCanvasItem = {
  kind: 'canvas';
  orderIndex: number;
  durationSec: number;
  canvas: PlaylistCanvasCompiled;
};

export type PlaylistItemUnion = PlaylistMediaItem | PlaylistCanvasItem;

export type PlaylistPayload = {
  workspaceId: string;
  screenId: string;
  playlistId: string | null;
  name: string | null;
  /** override | schedule | default — from scheduling engine */
  activeSource?: 'override' | 'schedule' | 'default';
  items: PlaylistItemUnion[];
};

export type BootstrapResponse = {
  screenId: string;
  serialNumber: string;
  workspaceId: string;
  /** Display name for idle / placeholder UI when no playlist is assigned. */
  workspaceName?: string | null;
  ticker: string | null;
  playlist: PlaylistPayload;
};
