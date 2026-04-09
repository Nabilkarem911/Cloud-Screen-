'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Ellipse,
  Group,
  Image as KonvaImage,
  Layer,
  Rect,
  Stage,
  Text,
} from 'react-konva';
import useImage from 'use-image';
import { toast } from 'sonner';
import {
  Circle as CircleIcon,
  Image as ImageIcon,
  Layers,
  Plus,
  Save,
  Shapes,
  Type,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/features/auth/session';
import { useWorkspace } from '@/features/workspace/workspace-context';
import type { MediaItem } from '@/features/media/media-library-client';
import {
  type CanvasLayoutV1,
  type CanvasObjectJson,
  emptyLayout,
} from '@/features/studio/canvas-layout';

type CanvasDto = {
  id: string;
  name: string;
  width: number;
  height: number;
  durationSec: number;
  layoutData: unknown;
};

function parseLayout(raw: unknown): CanvasLayoutV1 {
  if (typeof raw !== 'object' || raw === null) return emptyLayout();
  const o = raw as Record<string, unknown>;
  if (o.version === 1 && Array.isArray(o.objects)) {
    return { version: 1, objects: o.objects as CanvasObjectJson[] };
  }
  return emptyLayout();
}

function ImageShape({
  obj,
  onSelect,
  onMove,
}: {
  obj: CanvasObjectJson;
  onSelect: () => void;
  onMove: (id: string, x: number, y: number) => void;
}) {
  const [img] = useImage(obj.imageUrl ?? '', 'anonymous');
  if (!img || !obj.width || !obj.height) return null;
  return (
    <KonvaImage
      id={obj.id}
      name={obj.id}
      image={img}
      x={obj.x}
      y={obj.y}
      width={obj.width}
      height={obj.height}
      rotation={obj.rotation ?? 0}
      opacity={obj.opacity ?? 1}
      draggable
      onClick={(e) => {
        e.cancelBubble = true;
        onSelect();
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        onSelect();
      }}
      onDragEnd={(e) => {
        const n = e.target;
        onMove(obj.id, n.x(), n.y());
      }}
    />
  );
}

export function StudioEditorClient() {
  const t = useTranslations('studio');
  const { workspaceId } = useWorkspace();
  const [canvases, setCanvases] = useState<CanvasDto[]>([]);
  const [canvasId, setCanvasId] = useState('');
  const [name, setName] = useState('Untitled');
  const [dw, setDw] = useState(1920);
  const [dh, setDh] = useState(1080);
  const [layout, setLayout] = useState<CanvasLayoutV1>(emptyLayout());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [library, setLibrary] = useState<MediaItem[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 960, h: 540 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (cr) setSize({ w: cr.width, h: cr.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const loadLibrary = useCallback(async () => {
    if (!workspaceId) return;
    const res = await apiFetch(`/media?workspaceId=${encodeURIComponent(workspaceId)}`);
    if (res.ok) setLibrary((await res.json()) as MediaItem[]);
  }, [workspaceId]);

  const loadCanvases = useCallback(async () => {
    if (!workspaceId) return;
    const res = await apiFetch(`/canvases?workspaceId=${encodeURIComponent(workspaceId)}`);
    if (res.ok) setCanvases((await res.json()) as CanvasDto[]);
  }, [workspaceId]);

  const loadCanvas = useCallback(
    async (id: string) => {
      if (!workspaceId || !id) return;
      const res = await apiFetch(
        `/canvases/${id}?workspaceId=${encodeURIComponent(workspaceId)}`,
      );
      if (!res.ok) return;
      const c = (await res.json()) as CanvasDto;
      setName(c.name);
      setDw(c.width);
      setDh(c.height);
      setLayout(parseLayout(c.layoutData));
      setSelectedId(null);
    },
    [workspaceId],
  );

  useEffect(() => {
    void loadLibrary();
    void loadCanvases();
  }, [loadLibrary, loadCanvases]);

  useEffect(() => {
    if (canvasId) void loadCanvas(canvasId);
  }, [canvasId, loadCanvas]);

  const scale = useMemo(() => Math.min(size.w / dw, size.h / dh, 2), [size, dw, dh]);
  const ox = (size.w - dw * scale) / 2;
  const oy = (size.h - dh * scale) / 2;

  const selected = useMemo(
    () => layout.objects.find((o) => o.id === selectedId) ?? null,
    [layout.objects, selectedId],
  );

  const updateObject = (id: string, patch: Partial<CanvasObjectJson>) => {
    setLayout((prev) => ({
      ...prev,
      objects: prev.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    }));
  };

  const save = async () => {
    if (!workspaceId || !canvasId) {
      toast.error(t('saveNeedCanvas'));
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch(
        `/canvases/${canvasId}?workspaceId=${encodeURIComponent(workspaceId)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            name: name.trim() || 'Untitled',
            width: dw,
            height: dh,
            layoutData: layout,
            durationSec: 15,
          }),
        },
      );
      if (!res.ok) throw new Error('fail');
      toast.success(t('saved'));
      await loadCanvases();
    } catch {
      toast.error(t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const createCanvas = async () => {
    if (!workspaceId) return;
    const res = await apiFetch(
      `/canvases?workspaceId=${encodeURIComponent(workspaceId)}`,
      {
        method: 'POST',
        body: JSON.stringify({
          name: `Design ${canvases.length + 1}`,
          width: 1920,
          height: 1080,
          layoutData: emptyLayout(),
        }),
      },
    );
    if (!res.ok) {
      toast.error(t('createFailed'));
      return;
    }
    const created = (await res.json()) as { id: string };
    toast.success(t('created'));
    await loadCanvases();
    setCanvasId(created.id);
  };

  const addText = () => {
    const id = crypto.randomUUID();
    setLayout((prev) => ({
      ...prev,
      objects: [
        ...prev.objects,
        {
          id,
          type: 'text',
          x: 120,
          y: 120,
          text: 'Headline',
          fontSize: 72,
          fill: '#FF6B00',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", sans-serif',
          opacity: 1,
        },
      ],
    }));
    setSelectedId(id);
  };

  const addRect = () => {
    const id = crypto.randomUUID();
    setLayout((prev) => ({
      ...prev,
      objects: [
        ...prev.objects,
        {
          id,
          type: 'rect',
          x: 200,
          y: 200,
          width: 400,
          height: 220,
          fill: '#0F1729',
          opacity: 0.95,
          cornerRadius: 12,
        },
      ],
    }));
    setSelectedId(id);
  };

  const addEllipse = () => {
    const id = crypto.randomUUID();
    setLayout((prev) => ({
      ...prev,
      objects: [
        ...prev.objects,
        {
          id,
          type: 'ellipse',
          x: 300,
          y: 300,
          width: 280,
          height: 180,
          fill: '#0F1729',
          opacity: 0.9,
        },
      ],
    }));
    setSelectedId(id);
  };

  const onDropMedia = (e: React.DragEvent) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/canvas-media');
    if (!raw) return;
    const { publicUrl, mediaId } = JSON.parse(raw) as {
      publicUrl: string;
      mediaId: string;
    };
    const id = crypto.randomUUID();
    setLayout((prev) => ({
      ...prev,
      objects: [
        ...prev.objects,
        {
          id,
          type: 'image',
          x: 160,
          y: 160,
          width: 640,
          height: 360,
          imageUrl: publicUrl,
          mediaId,
          opacity: 1,
        },
      ],
    }));
    setSelectedId(id);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const renderObject = (obj: CanvasObjectJson) => {
    const common = {
      id: obj.id,
      name: obj.id,
      rotation: obj.rotation ?? 0,
      opacity: obj.opacity ?? 1,
      draggable: true as const,
      onClick: (e: { cancelBubble: boolean }) => {
        e.cancelBubble = true;
        setSelectedId(obj.id);
      },
      onDragEnd: (e: {
        target: { x: () => number; y: () => number; getLayer: () => unknown };
      }) => {
        const n = e.target;
        updateObject(obj.id, { x: n.x(), y: n.y() });
        n.getLayer();
      },
    };

    if (obj.type === 'rect') {
      return (
        <Rect
          key={obj.id}
          x={obj.x}
          y={obj.y}
          width={obj.width ?? 120}
          height={obj.height ?? 80}
          fill={obj.fill ?? '#0F1729'}
          stroke={obj.stroke}
          strokeWidth={obj.strokeWidth ?? 0}
          cornerRadius={obj.cornerRadius ?? 0}
          {...common}
        />
      );
    }
    if (obj.type === 'ellipse') {
      const rw = (obj.width ?? 120) / 2;
      const rh = (obj.height ?? 80) / 2;
      return (
        <Ellipse
          key={obj.id}
          id={obj.id}
          name={obj.id}
          x={obj.x + rw}
          y={obj.y + rh}
          radiusX={rw}
          radiusY={rh}
          fill={obj.fill ?? '#0F1729'}
          stroke={obj.stroke}
          strokeWidth={obj.strokeWidth ?? 0}
          rotation={obj.rotation ?? 0}
          opacity={obj.opacity ?? 1}
          draggable
          onClick={(e) => {
            e.cancelBubble = true;
            setSelectedId(obj.id);
          }}
          onDragEnd={(e) => {
            const n = e.target;
            updateObject(obj.id, { x: n.x() - rw, y: n.y() - rh });
          }}
        />
      );
    }
    if (obj.type === 'text') {
      return (
        <Text
          key={obj.id}
          x={obj.x}
          y={obj.y}
          text={obj.text ?? ''}
          fontSize={obj.fontSize ?? 48}
          fontFamily={
            obj.fontFamily ??
            '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'
          }
          fill={obj.fill ?? '#FF6B00'}
          width={obj.width}
          height={obj.height}
          {...common}
        />
      );
    }
    if (obj.type === 'image') {
      return (
        <ImageShape
          key={obj.id}
          obj={obj}
          onSelect={() => setSelectedId(obj.id)}
          onMove={(id, x, y) => updateObject(id, { x, y })}
        />
      );
    }
    return null;
  };

  if (!workspaceId) {
    return <p className="text-muted-foreground">{t('needWorkspace')}</p>;
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="vc-card-surface rounded-3xl border border-[#0F1729]/20 p-5 shadow-[0_0_60px_rgba(10,15,29,0.18)]"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <Label>{t('canvasSelect')}</Label>
            <select
              className="h-11 w-full max-w-md rounded-2xl border border-border bg-card px-4 text-[15px] outline-none focus:ring-4 focus:ring-primary/15"
              value={canvasId}
              onChange={(e) => setCanvasId(e.target.value)}
            >
              <option value="">{t('selectPlaceholder')}</option>
              {canvases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => void createCanvas()}>
              <Plus className="mr-2 h-4 w-4" />
              {t('newCanvas')}
            </Button>
            <Button type="button" variant="cta" disabled={!canvasId || saving} onClick={() => void save()}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? t('saving') : t('save')}
            </Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Label className="sr-only">{t('designName')}</Label>
          <Input
            className="max-w-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('designName')}
          />
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">{t('widthShort')}</Label>
            <Input
              type="number"
              className="h-10 w-24"
              value={dw}
              min={640}
              onChange={(e) => setDw(Number(e.target.value) || 1920)}
            />
            <Label className="text-xs text-muted-foreground">{t('heightShort')}</Label>
            <Input
              type="number"
              className="h-10 w-24"
              value={dh}
              min={480}
              onChange={(e) => setDh(Number(e.target.value) || 1080)}
            />
          </div>
        </div>
      </motion.div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-black/20 p-2 backdrop-blur-md">
            <Button type="button" size="sm" variant="ghost" onClick={addText}>
              <Type className="mr-1 h-4 w-4 text-[#FF6B00]" />
              {t('toolText')}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={addRect}>
              <Shapes className="mr-1 h-4 w-4 text-[#0F1729]" />
              {t('toolRect')}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={addEllipse}>
              <CircleIcon className="mr-1 h-4 w-4 text-primary" />
              {t('toolEllipse')}
            </Button>
          </div>

          <motion.div
            layout
            className="relative overflow-hidden rounded-3xl border border-cyan-500/15 bg-gradient-to-b from-zinc-950/90 to-black shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
            style={{ minHeight: 420 }}
          >
            <div
              ref={containerRef}
              className="h-[min(62vh,640px)] w-full"
              onDrop={onDropMedia}
              onDragOver={onDragOver}
            >
              <Stage
                width={size.w}
                height={size.h}
                onMouseDown={(e) => {
                  if (e.target === e.target.getStage()) setSelectedId(null);
                }}
              >
                <Layer>
                  <Rect x={0} y={0} width={size.w} height={size.h} fill="transparent" />
                  <Group x={ox} y={oy} scaleX={scale} scaleY={scale}>
                    <Rect x={0} y={0} width={dw} height={dh} fill="#030712" stroke="#0F1729" strokeWidth={2} />
                    {layout.objects.map((o) => renderObject(o))}
                  </Group>
                </Layer>
              </Stage>
            </div>
            <p className="pointer-events-none absolute bottom-3 start-4 text-[11px] font-medium uppercase tracking-[0.2em] text-white/35">
              {t('dropHint')}
            </p>
          </motion.div>

          <div className="rounded-3xl border border-border/60 bg-card/40 p-4 backdrop-blur-xl">
            <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <ImageIcon className="h-4 w-4" />
              {t('mediaStrip')}
            </p>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {library.map((m) => (
                <div
                  key={m.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      'application/canvas-media',
                      JSON.stringify({ publicUrl: m.publicUrl, mediaId: m.id }),
                    );
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  className="w-28 shrink-0 cursor-grab overflow-hidden rounded-2xl border border-border/80 bg-muted/50 active:cursor-grabbing"
                >
                  {m.mimeType.startsWith('image/') ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.publicUrl} alt="" className="h-20 w-full object-cover" />
                  ) : (
                    <video src={m.publicUrl} className="h-20 w-full object-cover" muted playsInline />
                  )}
                  <p className="truncate px-2 py-1 text-[10px] text-muted-foreground">{m.originalName}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <AnimatePresence>
          <motion.aside
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="vc-card-surface h-fit rounded-3xl border border-[#FF6B00]/15 p-5"
          >
            <p className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              <Layers className="h-4 w-4 text-[#FF6B00]" />
              {t('properties')}
            </p>
            {selected ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label className="text-xs">{t('fill')}</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      className="h-10 w-14 cursor-pointer p-1"
                      value={
                        selected.fill?.startsWith('#') ? selected.fill : '#0F1729'
                      }
                      onChange={(e) => updateObject(selected.id, { fill: e.target.value })}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-[#0F1729]/50 text-[#0F1729]"
                      onClick={() => updateObject(selected.id, { fill: '#0F1729' })}
                    >
                      {t('fillNavy')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-[#FF6B00]/50 text-[#FF6B00]"
                      onClick={() => updateObject(selected.id, { fill: '#FF6B00' })}
                    >
                      {t('fillOrange')}
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('opacity')}</Label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={selected.opacity ?? 1}
                    onChange={(e) =>
                      updateObject(selected.id, { opacity: Number(e.target.value) })
                    }
                    className="w-full accent-[#FF6B00]"
                  />
                </div>
                {selected.type === 'text' ? (
                  <div className="space-y-1">
                    <Label className="text-xs">{t('fontSize')}</Label>
                    <Input
                      type="number"
                      min={8}
                      max={400}
                      value={selected.fontSize ?? 48}
                      onChange={(e) =>
                        updateObject(selected.id, { fontSize: Number(e.target.value) || 48 })
                      }
                    />
                  </div>
                ) : null}
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setLayout((prev) => ({
                      ...prev,
                      objects: prev.objects.filter((o) => o.id !== selected.id),
                    }));
                    setSelectedId(null);
                  }}
                >
                  {t('removeObject')}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('selectObject')}</p>
            )}
          </motion.aside>
        </AnimatePresence>
      </div>
    </div>
  );
}
