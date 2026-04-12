'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Route } from 'next';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { Film, Folder, FolderPlus, ImageIcon, Pencil, Trash2, Upload, Sparkles } from 'lucide-react';
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
import { apiFetch, readApiErrorMessage } from '@/features/auth/session';
import { useWorkspace } from '@/features/workspace/workspace-context';
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
  folderId?: string | null;
  folderName?: string | null;
};

type MediaFolder = {
  id: string;
  name: string;
  createdAt: string;
  _count: { medias: number };
};

function MediaPreviewImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  const t = useTranslations('mediaClient');
  if (failed) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[#0F1729]/90 p-2 text-center">
        <ImageIcon className="h-8 w-8 shrink-0 text-[#FF6B00]/70" strokeWidth={1.5} />
        <span className="px-1 text-[10px] leading-tight text-muted-foreground">{t('previewUnavailable')}</span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={alt}
      src={src}
      className="h-full w-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

function MediaPreviewVideo({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  const t = useTranslations('mediaClient');
  if (failed) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[#0F1729]/90 p-2 text-center">
        <Film className="h-8 w-8 shrink-0 text-[#FF6B00]/70" strokeWidth={1.5} />
        <span className="px-1 text-[10px] leading-tight text-muted-foreground">{t('previewUnavailable')}</span>
      </div>
    );
  }
  return (
    <video
      src={src}
      className="h-full w-full object-cover"
      muted
      playsInline
      preload="metadata"
      onError={() => setFailed(true)}
    />
  );
}

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
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('all');
  const [newFolderName, setNewFolderName] = useState('');
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

  const loadFolders = useCallback(async () => {
    if (!workspaceId || scope === 'all') {
      setFolders([]);
      return;
    }
    const res = await apiFetch(
      `/media/folders/list?workspaceId=${encodeURIComponent(workspaceId)}`,
    );
    if (!res.ok) {
      setFolders([]);
      return;
    }
    const rows = (await res.json()) as MediaFolder[];
    setFolders(Array.isArray(rows) ? rows : []);
  }, [workspaceId, scope]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (scope !== 'branch') return;
    if (workspaceId) return;
    if (workspaces.length === 0) return;
    setScope('all');
  }, [scope, workspaceId, workspaces.length, setScope]);

  useEffect(() => {
    void loadFolders();
  }, [loadFolders]);

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
            `/media/upload?workspaceId=${encodeURIComponent(workspaceId)}${selectedFolderId !== 'all' ? `&folderId=${encodeURIComponent(selectedFolderId)}` : ''}`,
            { method: 'POST', body: form },
          );
          if (!res.ok) {
            const msg = await readApiErrorMessage(res);
            if (
              msg.includes('STORAGE_QUOTA_EXCEEDED') ||
              msg.includes('STORAGE_LIMIT_REACHED')
            ) {
              throw new Error('STORAGE_QUOTA_EXCEEDED');
            }
            throw new Error(msg || 'Upload failed');
          }
        }
        toast.success(t('uploadComplete'));
        await load();
        await loadFolders();
        bumpWorkspaceDataEpoch();
      } catch (e) {
        const msg = e instanceof Error ? e.message : '';
        if (
          msg.includes('STORAGE_QUOTA_EXCEEDED') ||
          msg.includes('STORAGE_LIMIT_REACHED')
        ) {
          toast.error(t('storageQuotaExceeded'));
        } else {
          toast.error(t('uploadFailed'));
        }
      } finally {
        setPending(false);
      }
    },
    [load, workspaceId, bumpWorkspaceDataEpoch, scope, t, selectedFolderId, loadFolders],
  );

  const onDrop = useCallback(
    async (accepted: File[]) => {
      await uploadFiles(accepted);
    },
    [uploadFiles],
  );

  const dropzoneEnabled = Boolean(workspaceId && scope === 'branch' && !pending);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    disabled: !workspaceId || pending || scope === 'all',
    noClick: !dropzoneEnabled,
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
    await loadFolders();
    bumpWorkspaceDataEpoch();
  };

  const createFolder = async () => {
    const name = newFolderName.trim();
    if (!workspaceId || !name || scope === 'all') return;
    const res = await apiFetch(
      `/media/folders?workspaceId=${encodeURIComponent(workspaceId)}`,
      { method: 'POST', body: JSON.stringify({ name }) },
    );
    if (!res.ok) {
      toast.error(t('folderCreateFailed'));
      return;
    }
    setNewFolderName('');
    toast.success(t('folderCreated'));
    await loadFolders();
  };

  const renameFolder = async (folderId: string, current: string) => {
    if (!workspaceId || scope === 'all') return;
    const name = window.prompt(t('folderRenamePrompt'), current)?.trim();
    if (!name || name === current) return;
    const res = await apiFetch(
      `/media/folders/${encodeURIComponent(folderId)}?workspaceId=${encodeURIComponent(workspaceId)}`,
      { method: 'PATCH', body: JSON.stringify({ name }) },
    );
    if (!res.ok) {
      toast.error(t('folderRenameFailed'));
      return;
    }
    toast.success(t('folderRenamed'));
    await loadFolders();
  };

  const deleteFolder = async (folderId: string) => {
    if (!workspaceId || scope === 'all') return;
    const confirmed = window.confirm(t('folderDeleteConfirm'));
    if (!confirmed) return;
    const res = await apiFetch(
      `/media/folders/${encodeURIComponent(folderId)}?workspaceId=${encodeURIComponent(workspaceId)}`,
      { method: 'DELETE' },
    );
    if (!res.ok) {
      toast.error(t('folderDeleteFailed'));
      return;
    }
    if (selectedFolderId === folderId) {
      setSelectedFolderId('all');
    }
    toast.success(t('folderDeleted'));
    await loadFolders();
    await load();
  };

  const moveMedia = async (mediaId: string, folderId: string) => {
    if (!workspaceId || scope === 'all') return;
    const nextFolderId = folderId === 'all' ? null : folderId;
    const res = await apiFetch(
      `/media/${encodeURIComponent(mediaId)}/folder?workspaceId=${encodeURIComponent(workspaceId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ folderId: nextFolderId }),
      },
    );
    if (!res.ok) {
      toast.error(t('moveFolderFailed'));
      return;
    }
    await load();
    await loadFolders();
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
        className="vc-glass vc-card-surface flex flex-col gap-6 rounded-3xl border border-[#FF6B00]/12 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8 dark:border-white/10"
      >
        <div className="min-w-0 flex-1">
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            {scope === 'all' ? t('descriptionAllBranches') : t('description')}
          </p>
          {workspaces.length > 1 ? (
            <div className="mt-4 inline-flex flex-wrap gap-2 rounded-2xl border border-[#FF6B00]/20 bg-[#0F1729]/30 p-1 dark:bg-black/20">
              <button
                type="button"
                onClick={() => setScope('branch')}
                className={cn(
                  'rounded-xl px-4 py-2 text-sm font-semibold transition',
                  scope === 'branch'
                    ? 'border border-[#FF6B00]/55 bg-[#FF6B00]/18 text-white'
                    : 'border border-transparent text-muted-foreground hover:text-foreground',
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
                    ? 'border border-[#FF6B00]/55 bg-[#FF6B00]/18 text-white'
                    : 'border border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {t('scopeAll')}
              </button>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,video/*"
            multiple
            onChange={onFileInputChange}
          />
          <button
            type="button"
            className={cn(
              'inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition',
              'border-[#FF6B00]/55 bg-[#FF6B00]/18 text-white hover:bg-[#FF6B00]/22',
              (pending || scope === 'all') && 'pointer-events-none opacity-50',
            )}
            onClick={onPickClick}
            disabled={pending || scope === 'all'}
          >
            <Upload className="h-4 w-4 shrink-0 text-[#FFB37A]" strokeWidth={2} />
            {pending ? t('uploading') : t('uploadFiles')}
          </button>
          <button
            type="button"
            className={cn(
              'inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition',
              'border-[#FF6B00]/25 bg-white/60 text-[#1B254B] hover:border-[#FF6B00]/50 hover:bg-[#FF6B00]/10',
              'dark:border-white/15 dark:bg-[#1B254B]/50 dark:text-white dark:hover:bg-[#FF6B00]/15',
              (pending || scope === 'all') && 'pointer-events-none opacity-50',
            )}
            onClick={open}
            disabled={pending || scope === 'all'}
          >
            {t('browse')}
          </button>
        </div>
      </motion.div>

      {scope === 'branch' ? (
        <div className="vc-card-surface rounded-2xl border border-border/70 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Folder className="h-4 w-4 text-[#FF6B00]" />
            <p className="text-sm font-semibold text-foreground">{t('foldersTitle')}</p>
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedFolderId('all')}
              className={cn(
                'rounded-lg border px-2.5 py-1 text-xs font-semibold',
                selectedFolderId === 'all'
                  ? 'border-[#FF6B00]/60 bg-[#FF6B00]/15 text-foreground'
                  : 'border-border text-muted-foreground',
              )}
            >
              {t('allFolders')}
            </button>
            {folders.map((folder) => (
              <div key={folder.id} className="inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedFolderId(folder.id)}
                  className={cn(
                    'rounded-lg border px-2.5 py-1 text-xs font-semibold',
                    selectedFolderId === folder.id
                      ? 'border-[#FF6B00]/60 bg-[#FF6B00]/15 text-foreground'
                      : 'border-border text-muted-foreground',
                  )}
                >
                  {folder.name} ({folder._count.medias})
                </button>
                <button type="button" onClick={() => void renameFolder(folder.id, folder.name)} className="rounded p-1 text-muted-foreground hover:text-foreground">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => void deleteFolder(folder.id)} className="rounded p-1 text-muted-foreground hover:text-red-500">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder={t('folderNamePlaceholder')}
              className="h-9 min-w-[220px] rounded-lg border border-border bg-background px-3 text-sm"
            />
            <Button
              type="button"
              variant="outline"
              className="rounded-lg"
              onClick={() => void createFolder()}
              disabled={!newFolderName.trim()}
            >
              <FolderPlus className="me-1 h-4 w-4" />
              {t('createFolder')}
            </Button>
          </div>
        </div>
      ) : null}

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
              <button
                type="button"
                className={cn(
                  'inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition',
                  'border-[#FF6B00]/55 bg-[#FF6B00]/18 text-white hover:bg-[#FF6B00]/22',
                )}
                onClick={onPickClick}
              >
                <Upload className="h-4 w-4 shrink-0 text-[#FFB37A]" strokeWidth={2} />
                {t('uploadFirst')}
              </button>
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
                {items
                  .filter((m) =>
                    selectedFolderId === 'all'
                      ? true
                      : (m.folderId ?? null) === selectedFolderId,
                  )
                  .map((m, i) => (
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
                        <MediaPreviewImage src={m.publicUrl} alt="" />
                      ) : (
                        <MediaPreviewVideo src={m.publicUrl} />
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
                      {scope === 'branch' ? (
                        <select
                          className="h-7 w-full rounded border border-border bg-background px-2 text-[11px]"
                          value={m.folderId ?? 'all'}
                          onChange={(e) => {
                            void moveMedia(m.id, e.target.value);
                          }}
                        >
                          <option value="all">{t('noFolder')}</option>
                          {folders.map((folder) => (
                            <option key={folder.id} value={folder.id}>
                              {folder.name}
                            </option>
                          ))}
                        </select>
                      ) : null}
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
