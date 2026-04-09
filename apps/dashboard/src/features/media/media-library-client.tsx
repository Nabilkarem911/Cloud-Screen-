'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Route } from 'next';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { Film, ImageIcon, Trash2, Upload, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/features/auth/session';
import { useWorkspace } from '@/features/workspace/workspace-context';
import { DemoDataButton } from '@/features/workspace/demo-data-button';
import { cn } from '@/lib/utils';

export type MediaItem = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  publicUrl: string;
  createdAt: string;
  /** Present when listing aggregated account media */
  workspaceId?: string;
  workspaceName?: string;
};

function EmptyMediaIllustration() {
  return (
    <div className="relative mx-auto flex max-w-md flex-col items-center">
      <svg
        viewBox="0 0 400 280"
        className="h-48 w-full text-[#0F1729]/25 dark:text-[#0F1729]/40"
        aria-hidden
      >
        <defs>
          <linearGradient id="mg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.9" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        <rect x="48" y="40" width="304" height="200" rx="24" fill="url(#mg)" opacity="0.35" />
        <rect
          x="72"
          y="64"
          width="120"
          height="90"
          rx="12"
          fill="currentColor"
          opacity="0.15"
        />
        <circle cx="260" cy="96" r="28" fill="#FF6B00" opacity="0.35" />
        <path
          d="M88 200h224"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          opacity="0.2"
        />
        <path
          d="M88 220h160"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          opacity="0.12"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center pt-8">
        <div className="rounded-3xl border border-white/20 bg-white/10 px-6 py-4 shadow-2xl backdrop-blur-md dark:bg-black/20">
          <Sparkles className="mx-auto h-10 w-10 text-[#FF6B00]" strokeWidth={1.5} />
        </div>
      </div>
    </div>
  );
}

export function MediaLibraryClient() {
  const locale = useLocale();
  const t = useTranslations('mediaClient');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const scope = searchParams.get('scope') === 'all' ? 'all' : 'branch';
  const { workspaceId, workspaces, bumpWorkspaceDataEpoch } = useWorkspace();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; workspaceId: string } | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoSeedAttemptedRef = useRef(false);

  const setScope = useCallback(
    (next: 'branch' | 'all') => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === 'all') params.set('scope', 'all');
      else params.delete('scope');
      const q = params.toString();
      router.push((q ? `${pathname}?${q}` : pathname) as Route);
    },
    [pathname, router, searchParams],
  );

  const load = useCallback(async () => {
    setLoading(true);
    if (scope === 'all') {
      if (workspaces.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }
      const results = await Promise.all(
        workspaces.map(async (w) => {
          const res = await apiFetch(`/media?workspaceId=${encodeURIComponent(w.id)}`);
          if (!res.ok) return [] as MediaItem[];
          const data = (await res.json()) as MediaItem[];
          return data.map((m) => ({
            ...m,
            workspaceId: w.id,
            workspaceName: w.name,
          }));
        }),
      );
      setItems(results.flat());
      setLoading(false);
      return;
    }
    if (!workspaceId) {
      setItems([]);
      setLoading(false);
      return;
    }
    const res = await apiFetch(`/media?workspaceId=${encodeURIComponent(workspaceId)}`);
    if (res.ok) {
      const data = (await res.json()) as MediaItem[];
      setItems(data);
    } else {
      setItems([]);
    }
    setLoading(false);
  }, [workspaceId, scope, workspaces]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (scope !== 'branch' || !workspaceId || loading || pending || items.length > 0) return;
    if (autoSeedAttemptedRef.current) return;
    autoSeedAttemptedRef.current = true;
    void (async () => {
      const res = await apiFetch(
        `/workspaces/${encodeURIComponent(workspaceId)}/seed-demo`,
        { method: 'POST' },
      );
      if (res.ok) {
        bumpWorkspaceDataEpoch();
        await load();
      } else {
        autoSeedAttemptedRef.current = false;
      }
    })();
  }, [scope, workspaceId, loading, pending, items.length, load, bumpWorkspaceDataEpoch]);

  const uploadFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (scope === 'all') {
        toast.error(t('uploadRequiresBranch'));
        return;
      }
      if (!workspaceId || files.length === 0) return;
      setPending(true);
      try {
        for (const file of files) {
          const form = new FormData();
          form.append('file', file);
          const res = await apiFetch(
            `/media/upload?workspaceId=${encodeURIComponent(workspaceId)}`,
            { method: 'POST', body: form },
          );
          if (!res.ok) throw new Error('Upload failed');
        }
        toast.success(t('uploadComplete'));
        await load();
        bumpWorkspaceDataEpoch();
      } catch {
        toast.error(t('uploadFailed'));
      } finally {
        setPending(false);
      }
    },
    [load, workspaceId, bumpWorkspaceDataEpoch, scope, t],
  );

  const onDrop = useCallback(
    async (accepted: File[]) => {
      await uploadFiles(accepted);
    },
    [uploadFiles],
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    disabled: !workspaceId || pending || scope === 'all',
    noClick: true,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'video/*': ['.mp4', '.webm', '.mov'],
    },
    maxSize: 150 * 1024 * 1024,
  });

  const onPickClick = () => {
    fileInputRef.current?.click();
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files;
    if (f?.length) void uploadFiles(f);
    e.target.value = '';
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const ws = deleteTarget.workspaceId;
    const res = await apiFetch(`/media/${deleteTarget.id}?workspaceId=${encodeURIComponent(ws)}`, {
      method: 'DELETE',
    });
    setDeleteTarget(null);
    if (!res.ok) {
      toast.error(t('deleteFailed'));
      return;
    }
    toast.success(t('deleted'));
    await load();
    bumpWorkspaceDataEpoch();
  };

  if (scope === 'branch' && !workspaceId) {
    return <p className="text-[15px] text-muted-foreground">{t('selectWorkspace')}</p>;
  }

  if (scope === 'all' && workspaces.length === 0) {
    return <p className="text-[15px] text-muted-foreground">{t('selectWorkspace')}</p>;
  }

  return (
    <div className="flex min-h-[calc(100vh-12rem)] flex-col gap-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="vc-glass vc-card-surface flex flex-col gap-6 rounded-3xl border border-[rgba(147,51,234,0.22)] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8"
      >
        <div className="min-w-0 flex-1">
          <p className="vc-page-kicker">{t('kicker')}</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
            {t('title')}
          </h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            {scope === 'all' ? t('descriptionAllBranches') : t('description')}
          </p>
          {workspaces.length > 1 ? (
            <div className="mt-4 inline-flex rounded-2xl border border-[#FF6B00]/20 bg-[#0F1729]/30 p-1 dark:bg-black/20">
              <button
                type="button"
                onClick={() => setScope('branch')}
                className={cn(
                  'rounded-xl px-4 py-2 text-sm font-semibold transition',
                  scope === 'branch'
                    ? 'bg-[#FF6B00] text-amber-950 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t('scopeBranch')}
              </button>
              <button
                type="button"
                onClick={() => setScope('all')}
                className={cn(
                  'rounded-xl px-4 py-2 text-sm font-semibold transition',
                  scope === 'all'
                    ? 'bg-[#FF6B00] text-amber-950 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t('scopeAll')}
              </button>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,video/*"
            multiple
            onChange={onFileInputChange}
          />
          <Button
            type="button"
            size="lg"
            className="rounded-2xl bg-gradient-to-r from-[#FF6B00] to-[#CC4400] px-8 font-semibold text-white shadow-[0_8px_28px_-8px_rgba(10,15,29,0.45),0_0_24px_-8px_rgba(255,107,0,0.22)] hover:opacity-95"
            onClick={onPickClick}
            disabled={pending || scope === 'all'}
          >
            <Upload className="me-2 h-5 w-5 text-white" strokeWidth={2} />
            {pending ? t('uploading') : t('uploadFiles')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="rounded-2xl border-[#FF6B00]/40 bg-[#FF6B00]/5 font-medium hover:bg-[#FF6B00]/10"
            onClick={open}
            disabled={pending || scope === 'all'}
          >
            {t('browse')}
          </Button>
        </div>
      </motion.div>

      <div
        {...getRootProps()}
        className={cn(
          'relative flex min-h-[320px] flex-1 flex-col rounded-3xl border-2 border-dashed transition-colors',
          isDragActive
            ? 'border-[#0F1729]/60 bg-[#0F1729]/[0.06]'
            : 'border-border/70 bg-muted/20',
        )}
      >
        <input {...getInputProps()} />

        {loading ? (
          <div className="flex flex-1 items-center justify-center py-24 text-muted-foreground">
            {t('loading')}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-16 text-center">
            <EmptyMediaIllustration />
            <div className="space-y-2">
              <p className="text-lg font-semibold text-foreground">{t('emptyTitle')}</p>
              <p className="max-w-md text-sm text-muted-foreground">
                {t('emptyDescription')}
              </p>
            </div>
            {scope === 'branch' ? (
              <div className="flex flex-wrap items-center justify-center gap-3">
                <DemoDataButton onDone={() => void load()} />
                <Button
                  type="button"
                  size="lg"
                  className="rounded-2xl bg-gradient-to-r from-[#FF6B00] to-amber-500 font-semibold text-amber-950 shadow-md"
                  onClick={onPickClick}
                >
                  <Upload className="me-2 h-5 w-5" />
                  {t('uploadFirst')}
                </Button>
              </div>
            ) : (
              <p className="max-w-md text-sm text-muted-foreground">{t('emptyAllBranchesHint')}</p>
            )}
          </div>
        ) : (
          <div className="p-4 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                <span className="font-mono-nums text-foreground">{new Intl.NumberFormat(locale).format(items.length)}</span> {t('files')}
              </p>
              <p className="text-xs text-muted-foreground">
                {isDragActive ? t('releaseToAdd') : t('dropMore')}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <AnimatePresence mode="popLayout">
                {items.map((m, i) => (
                  <motion.div
                    key={m.workspaceId ? `${m.workspaceId}-${m.id}` : m.id}
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ delay: i * 0.02, duration: 0.25 }}
                    className="ngl-media-tile group relative overflow-hidden rounded-2xl"
                  >
                    <div className="relative aspect-[4/3] bg-black/80">
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
                          preload="metadata"
                        />
                      )}
                      <div className="absolute left-2 top-2 flex items-center gap-1 rounded-lg border border-[#FF6B00]/25 bg-black/55 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/95 shadow-[0_0_16px_-4px_rgba(255, 107, 0,0.2)] backdrop-blur-md">
                        {m.mimeType.startsWith('video/') ? (
                          <Film className="ngl-media-icon-accent h-3 w-3" />
                        ) : (
                          <ImageIcon className="ngl-media-icon-accent h-3 w-3" />
                        )}
                        {m.mimeType.startsWith('video/') ? t('video') : t('image')}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const wid = m.workspaceId ?? workspaceId;
                          if (!wid) return;
                          setDeleteTarget({ id: m.id, workspaceId: wid });
                        }}
                        className="absolute end-2 top-2 flex h-9 w-9 items-center justify-center rounded-xl bg-black/55 text-white opacity-0 shadow-lg backdrop-blur transition hover:bg-red-600/90 group-hover:opacity-100"
                        aria-label={t('delete')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="space-y-1 p-3">
                      {m.workspaceName ? (
                        <p className="mb-1 truncate text-[10px] font-bold uppercase tracking-wide text-[#FF6B00]">
                          {m.workspaceName}
                        </p>
                      ) : null}
                      <p className="truncate text-sm font-medium leading-tight text-foreground">
                        {m.originalName}
                      </p>
                      <p className="font-mono-nums text-xs text-muted-foreground">
                        {new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(m.sizeBytes / 1024 / 1024)} MB
                      </p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={deleteTarget !== null} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-3xl border-border/80">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmDelete()}
              className="rounded-xl bg-red-600 hover:bg-red-600"
            >
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
