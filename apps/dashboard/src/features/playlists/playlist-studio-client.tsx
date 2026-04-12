'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from '@hello-pangea/dnd';
import { motion } from 'framer-motion';
import {
  ChevronDown,
  ChevronUp,
  Film,
  GripVertical,
  ImageIcon,
  Layers,
  Library,
  PenLine,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/features/auth/session';
import { useWorkspace } from '@/features/workspace/workspace-context';
import type { MediaItem } from '@/features/media/media-library-client';

type PlaylistSummary = {
  id: string;
  name: string;
  _count: { items: number };
};

type CanvasSummary = {
  id: string;
  name: string;
};

type Row =
  | {
      clientId: string;
      kind: 'media';
      mediaId: string;
      durationSec: number;
      media: MediaItem;
    }
  | {
      clientId: string;
      kind: 'canvas';
      canvasId: string;
      durationSec: number;
      canvas: CanvasSummary;
    };

export function PlaylistStudioClient() {
  const t = useTranslations('playlistStudioClient');
  const { workspaceId, bumpWorkspaceDataEpoch } = useWorkspace();
  const [library, setLibrary] = useState<MediaItem[]>([]);
  const [canvasLibrary, setCanvasLibrary] = useState<CanvasSummary[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [playlistId, setPlaylistId] = useState<string>('');
  const [newName, setNewName] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadLibrary = useCallback(async () => {
    if (!workspaceId) return;
    const res = await apiFetch(`/media?workspaceId=${encodeURIComponent(workspaceId)}`);
    if (res.ok) setLibrary((await res.json()) as MediaItem[]);
  }, [workspaceId]);

  const loadPlaylists = useCallback(async () => {
    if (!workspaceId) return;
    const res = await apiFetch(`/playlists?workspaceId=${encodeURIComponent(workspaceId)}`);
    if (res.ok) setPlaylists((await res.json()) as PlaylistSummary[]);
  }, [workspaceId]);

  const loadCanvasLibrary = useCallback(async () => {
    if (!workspaceId) return;
    const res = await apiFetch(`/canvases?workspaceId=${encodeURIComponent(workspaceId)}`);
    if (res.ok) setCanvasLibrary((await res.json()) as CanvasSummary[]);
  }, [workspaceId]);

  const loadPlaylistDetail = useCallback(
    async (id: string) => {
      if (!workspaceId) return;
      const res = await apiFetch(
        `/playlists/${id}?workspaceId=${encodeURIComponent(workspaceId)}`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        items: Array<{
          kind?: string;
          durationSec: number;
          media?: MediaItem;
          canvas?: { id: string; name: string };
        }>;
      };
      setRows(
        data.items
          .map((it) => {
            if (it.kind === 'canvas' && it.canvas) {
              return {
                clientId: crypto.randomUUID(),
                kind: 'canvas' as const,
                canvasId: it.canvas.id,
                durationSec: it.durationSec,
                canvas: { id: it.canvas.id, name: it.canvas.name },
              };
            }
            if (it.media) {
              return {
                clientId: crypto.randomUUID(),
                kind: 'media' as const,
                mediaId: it.media.id,
                durationSec: it.durationSec,
                media: it.media,
              };
            }
            return null;
          })
          .filter((r): r is Row => r !== null),
      );
    },
    [workspaceId],
  );

  useEffect(() => {
    if (!workspaceId) return;
    setLoading(true);
    void (async () => {
      await loadLibrary();
      await loadPlaylists();
      await loadCanvasLibrary();
      setLoading(false);
    })();
  }, [workspaceId, loadLibrary, loadPlaylists, loadCanvasLibrary]);

  useEffect(() => {
    if (playlistId) void loadPlaylistDetail(playlistId);
    else setRows([]);
  }, [playlistId, loadPlaylistDetail]);

  const createPlaylist = async () => {
    if (!workspaceId || !newName.trim()) return;
    const res = await apiFetch('/playlists', {
      method: 'POST',
      body: JSON.stringify({ workspaceId, name: newName.trim() }),
    });
    if (!res.ok) {
      toast.error(t('couldNotCreatePlaylist'));
      return;
    }
    const created = (await res.json()) as { id: string };
    toast.success(t('playlistCreated'));
    setNewName('');
    await loadPlaylists();
    bumpWorkspaceDataEpoch();
    setPlaylistId(created.id);
  };

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;

    if (source.droppableId === 'library' && destination.droppableId === 'playlist') {
      const mediaId = draggableId.replace('lib-', '');
      const media = library.find((m) => m.id === mediaId);
      if (!media) return;
      const next = Array.from(rows);
      next.splice(destination.index, 0, {
        clientId: crypto.randomUUID(),
        kind: 'media',
        mediaId: media.id,
        durationSec: 10,
        media,
      });
      setRows(next);
      return;
    }

    if (source.droppableId === 'canvas-library' && destination.droppableId === 'playlist') {
      const canvasId = draggableId.replace('cvs-', '');
      const canvas = canvasLibrary.find((c) => c.id === canvasId);
      if (!canvas) return;
      const next = Array.from(rows);
      next.splice(destination.index, 0, {
        clientId: crypto.randomUUID(),
        kind: 'canvas',
        canvasId: canvas.id,
        durationSec: 15,
        canvas: { id: canvas.id, name: canvas.name },
      });
      setRows(next);
      return;
    }

    if (source.droppableId === 'playlist' && destination.droppableId === 'playlist') {
      const next = Array.from(rows);
      const [removed] = next.splice(source.index, 1);
      if (!removed) return;
      next.splice(destination.index, 0, removed);
      setRows(next);
    }
  };

  const updateDuration = (clientId: string, value: number) => {
    setRows((prev) =>
      prev.map((r) =>
        r.clientId === clientId ? { ...r, durationSec: Math.max(1, value) } : r,
      ),
    );
  };

  const removeRow = (clientId: string) => {
    setRows((prev) => prev.filter((r) => r.clientId !== clientId));
  };

  const moveRow = (index: number, delta: -1 | 1) => {
    setRows((prev) => {
      const next = [...prev];
      const j = index + delta;
      if (j < 0 || j >= next.length) return prev;
      const tmp = next[index];
      next[index] = next[j]!;
      next[j] = tmp!;
      return next;
    });
  };

  const savePlaylist = async () => {
    if (!workspaceId || !playlistId) return;
    setSaving(true);
    try {
      const body = {
        items: rows.map((r, index) =>
          r.kind === 'media'
            ? {
                mediaId: r.mediaId,
                durationSec: r.durationSec,
                orderIndex: index,
              }
            : {
                canvasId: r.canvasId,
                durationSec: r.durationSec,
                orderIndex: index,
              },
        ),
      };
      const res = await apiFetch(
        `/playlists/${playlistId}/items?workspaceId=${encodeURIComponent(workspaceId)}`,
        {
          method: 'PATCH',
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) throw new Error('save failed');
      toast.success(t('playlistSaved'));
      bumpWorkspaceDataEpoch();
      await loadPlaylistDetail(playlistId);
    } catch {
      toast.error(t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (!workspaceId) {
    return <p className="text-[15px] text-muted-foreground">{t('selectWorkspaceFirst')}</p>;
  }

  return (
    <div className="space-y-10">
      <motion.div
        className="vc-glass vc-card-surface rounded-3xl p-6 sm:p-8"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:gap-8">
          <div className="min-w-[200px] flex-1 space-y-2">
            <Label>{t('playlist')}</Label>
            <select
              className="h-11 w-full rounded-2xl border border-border bg-card px-4 text-[15px] text-foreground outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
              value={playlistId}
              onChange={(e) => setPlaylistId(e.target.value)}
            >
              <option value="">{t('selectOption')}</option>
              {playlists.map((p) => (
                <option key={p.id} value={p.id}>
                  {t('playlistItems', { name: p.name, count: p._count.items })}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-1 flex-wrap gap-3">
            <Input
              placeholder={t('newPlaylistPlaceholder')}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="max-w-xs rounded-xl"
            />
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl"
              onClick={() => void createPlaylist()}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('create')}
            </Button>
            <Button
              type="button"
              className="rounded-2xl bg-gradient-to-r from-[#FF6B00] to-[#CC4400] font-semibold shadow-lg shadow-[#0F1729]/30"
              onClick={() => void savePlaylist()}
              disabled={!playlistId || saving}
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? t('saving') : t('savePlaylist')}
            </Button>
          </div>
        </div>
      </motion.div>

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-3xl border border-dashed border-border/80 bg-muted/20">
          <p className="text-[15px] text-muted-foreground">{t('loadingStudio')}</p>
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid gap-8 xl:grid-cols-2 xl:gap-10">
            <div className="space-y-8">
              <div className="rounded-3xl border border-[#0F1729]/15 bg-gradient-to-b from-[#0F1729]/[0.06] to-transparent p-1">
                <div className="flex items-center gap-2 border-b border-border/50 px-5 py-4">
                  <Library className="h-5 w-5 text-[#0F1729]" />
                  <h3 className="text-sm font-semibold tracking-tight text-foreground">
                    {t('mediaLibrary')}
                  </h3>
                  <span className="ms-auto font-mono-nums text-xs text-muted-foreground">
                    {t('assetsCount', { count: library.length })}
                  </span>
                </div>
                <Droppable droppableId="library" direction="vertical">
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="max-h-[min(52vh,520px)] space-y-2 overflow-y-auto p-4"
                    >
                      {library.map((m, index) => (
                        <Draggable key={m.id} draggableId={`lib-${m.id}`} index={index}>
                          {(p) => (
                            <div
                              ref={p.innerRef}
                              {...p.draggableProps}
                              {...p.dragHandleProps}
                              className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card/80 px-3 py-2.5 shadow-sm transition hover:scale-[1.01] hover:shadow-md dark:bg-card/50"
                            >
                              <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <div className="relative h-10 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                                {m.mimeType.startsWith('image/') ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    alt=""
                                    src={m.publicUrl}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <video
                                    src={m.publicUrl}
                                    className="h-full w-full object-cover"
                                    muted
                                    playsInline
                                  />
                                )}
                                <span className="absolute bottom-0.5 right-0.5 rounded bg-black/60 p-0.5">
                                  {m.mimeType.startsWith('video/') ? (
                                    <Film className="h-2.5 w-2.5 text-[#FF6B00]" />
                                  ) : (
                                    <ImageIcon className="h-2.5 w-2.5 text-white" />
                                  )}
                                </span>
                              </div>
                              <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-foreground">
                                {m.originalName}
                              </span>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>

              <div className="rounded-3xl border border-[#FF6B00]/20 bg-gradient-to-b from-[#FF6B00]/[0.06] to-transparent p-1">
                <div className="flex items-center gap-2 border-b border-border/50 px-5 py-4">
                  <PenLine className="h-5 w-5 text-[#FF6B00]" />
                  <h3 className="text-sm font-semibold tracking-tight text-foreground">
                    {t('canvasDesigns')}
                  </h3>
                  <span className="ms-auto font-mono-nums text-xs text-muted-foreground">
                    {t('designsCount', { count: canvasLibrary.length })}
                  </span>
                </div>
                <Droppable droppableId="canvas-library" direction="vertical">
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="max-h-[min(40vh,400px)] space-y-2 overflow-y-auto p-4"
                    >
                      {canvasLibrary.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          {t('canvasEmpty')}
                        </p>
                      ) : (
                        canvasLibrary.map((c, index) => (
                          <Draggable key={c.id} draggableId={`cvs-${c.id}`} index={index}>
                            {(p) => (
                              <div
                                ref={p.innerRef}
                                {...p.draggableProps}
                                {...p.dragHandleProps}
                                className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card/80 px-3 py-2.5 shadow-sm transition hover:scale-[1.01] hover:shadow-md dark:bg-card/50"
                              >
                                <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF6B00] to-[#CC4400]">
                                  <PenLine className="h-5 w-5 text-white" />
                                </span>
                                <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-foreground">
                                  {c.name}
                                </span>
                              </div>
                            )}
                          </Draggable>
                        ))
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            </div>

            <div className="rounded-3xl border-2 border-dashed border-[#0F1729]/25 bg-gradient-to-br from-[#0F1729]/[0.07] via-card to-[#FF6B00]/[0.04] p-1 shadow-inner">
              <div className="flex items-center gap-2 border-b border-border/50 px-5 py-4">
                <Layers className="h-5 w-5 text-[#0F1729]" />
                <h3 className="text-sm font-semibold tracking-tight text-foreground">
                  {t('programTimeline')}
                </h3>
                <span className="ms-auto font-mono-nums text-xs text-muted-foreground">
                  {t('itemsCount', { count: rows.length })}
                </span>
              </div>
              <Droppable droppableId="playlist" direction="vertical">
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="min-h-[min(60vh,560px)] space-y-2 p-4"
                  >
                    {rows.map((row, index) => (
                      <Draggable key={row.clientId} draggableId={row.clientId} index={index}>
                        {(p) => (
                          <div
                            ref={p.innerRef}
                            {...p.draggableProps}
                            className="rounded-2xl border border-border/60 bg-card/95 p-4 shadow-md ring-1 ring-primary/5 transition hover:border-[#0F1729]/35 hover:shadow-lg dark:bg-card/80"
                          >
                            <div className="flex items-start gap-3">
                              <button
                                type="button"
                                className="mt-1 text-muted-foreground"
                                {...p.dragHandleProps}
                              >
                                <GripVertical className="h-4 w-4" />
                              </button>
                              <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                                {row.kind === 'media' ? (
                                  row.media.mimeType.startsWith('image/') ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      alt=""
                                      src={row.media.publicUrl}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <video
                                      src={row.media.publicUrl}
                                      className="h-full w-full object-cover"
                                      muted
                                      playsInline
                                    />
                                  )
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#0F1729] to-[#0c1220]">
                                    <PenLine className="h-6 w-6 text-[#FF6B00]" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1 space-y-2">
                                <p className="truncate text-[15px] font-semibold text-foreground">
                                  {row.kind === 'media'
                                    ? row.media.originalName
                                    : row.canvas.name}
                                </p>
                                <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                                  {row.kind === 'media' ? t('media') : t('canvas')}
                                </p>
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="flex flex-col gap-1">
                                    <Label className="text-xs">{t('durationSec')}</Label>
                                    {row.kind === 'media' &&
                                    row.media.mimeType.startsWith('image/') ? (
                                      <p className="max-w-[14rem] text-[11px] leading-snug text-muted-foreground">
                                        {t('imageDurationHint')}
                                      </p>
                                    ) : null}
                                  </div>
                                  <Input
                                    type="number"
                                    min={1}
                                    className="h-9 w-24 rounded-lg font-mono-nums"
                                    value={row.durationSec}
                                    onChange={(e) =>
                                      updateDuration(row.clientId, Number(e.target.value) || 1)
                                    }
                                  />
                                  <div className="ms-auto flex items-center gap-1">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      className="h-9 w-9 shrink-0 rounded-lg"
                                      disabled={index === 0}
                                      title={t('moveUp')}
                                      onClick={() => moveRow(index, -1)}
                                    >
                                      <ChevronUp className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      className="h-9 w-9 shrink-0 rounded-lg"
                                      disabled={index >= rows.length - 1}
                                      title={t('moveDown')}
                                      onClick={() => moveRow(index, 1)}
                                    >
                                      <ChevronDown className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="text-red-500 hover:bg-red-500/10 hover:text-red-600"
                                      onClick={() => removeRow(row.clientId)}
                                    >
                                      <Trash2 className="mr-1 h-4 w-4" />
                                      {t('delete')}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          </div>
        </DragDropContext>
      )}
    </div>
  );
}
