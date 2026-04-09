'use client';
/* eslint-disable react-hooks/incompatible-library */

import Link from 'next/link';
import type { Route } from 'next';
import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import {
  MoreHorizontal,
  PenLine,
  Plus,
  Power,
  RefreshCw,
  Monitor,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/features/auth/session';
import { useWorkspace } from '@/features/workspace/workspace-context';
import { DemoDataButton } from '@/features/workspace/demo-data-button';
import { cn } from '@/lib/utils';
import { ScreenQuickEditPanel } from '@/features/screens/screen-quick-edit-panel';
import { useScreenActivePreview } from '@/features/screens/use-screen-active-preview';
import { useApiScreens, type ScreenRow, type ScreenStatus } from './useApiScreens';
import { useScreenRealtime } from './useScreenRealtime';

const screenSchema = z.object({
  name: z.string().min(2),
  serialNumber: z.string().min(4),
  location: z.string().optional(),
});

const editSchema = screenSchema.extend({
  status: z.enum(['ONLINE', 'OFFLINE', 'MAINTENANCE']),
});

type Props = {
  locale: string;
};

function LiveBadge({ status }: { status: ScreenStatus }) {
  const t = useTranslations('screensClient');
  const live = status === 'ONLINE';
  const maintenance = status === 'MAINTENANCE';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]',
        live &&
          'border border-emerald-400/40 bg-emerald-500/15 text-emerald-100 shadow-[0_0_18px_rgba(16,185,129,0.45)]',
        !live &&
          maintenance &&
          'border border-amber-400/35 bg-amber-500/12 text-amber-100 shadow-[0_0_14px_rgba(245,158,11,0.35)]',
        !live &&
          !maintenance &&
          'border border-red-400/35 bg-red-500/12 text-red-100 shadow-[0_0_16px_rgba(239,68,68,0.35)]',
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          live && 'animate-pulse bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]',
          maintenance && 'bg-amber-400',
          !live && !maintenance && 'bg-red-400',
        )}
      />
      {live ? t('status.live') : maintenance ? t('status.maintenance') : t('status.offline')}
    </span>
  );
}

function ScreenVisualCard({
  screen,
  locale,
  workspaceId,
  index,
  onCardClick,
  onEdit,
  onDelete,
  onRemote,
}: {
  screen: ScreenRow;
  locale: string;
  workspaceId: string;
  index: number;
  onCardClick: (s: ScreenRow) => void;
  onEdit: (s: ScreenRow) => void;
  onDelete: (id: string) => void;
  onRemote: (id: string, c: 'refresh_content' | 'restart') => void;
}) {
  const t = useTranslations('screensClient');
  const { previewUrl, loading } = useScreenActivePreview(screen.id, workspaceId);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.04, type: 'spring', stiffness: 420, damping: 28 }}
      whileHover={{ scale: 1.015, y: -2 }}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-[1.35rem]',
        'border border-[rgba(147,51,234,0.28)] bg-[hsl(260_32%_11%/0.42)] shadow-[0_8px_40px_-12px_rgba(0,0,0,0.45)] backdrop-blur-[36px]',
        'ring-1 ring-[rgba(255,107,0,0.18)] transition-[border-color,box-shadow] duration-300',
        'hover:border-[rgba(255, 107, 0,0.28)] hover:shadow-[0_0_40px_-12px_rgba(255, 107, 0,0.1)]',
        screen.status === 'ONLINE' && 'ngl-screen-card-live',
      )}
    >
      <button
        type="button"
        onClick={() => onCardClick(screen)}
        className="relative block w-full text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F1729]/50"
      >
        <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-[#0F1729]/35 via-slate-900/45 to-black/65">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt=""
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#0F1729]/25 to-[#0c1220]/40">
              <Monitor className="h-12 w-12 text-white/25" strokeWidth={1.25} />
            </div>
          )}
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-xs font-medium text-white/80 backdrop-blur-[1px]">
              {t('loadingPreview')}
            </div>
          ) : null}
          <div className="absolute start-3 top-3">
            <LiveBadge status={screen.status} />
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-4 pt-10">
            <p className="truncate text-base font-semibold text-white drop-shadow-md">{screen.name}</p>
            <p className="font-mono text-[11px] text-white/70">{screen.serialNumber}</p>
          </div>
        </div>
      </button>

      <div className="flex flex-1 flex-col gap-3 border-t border-white/10 bg-white/[0.04] p-4 dark:bg-black/10">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <p className="truncate text-xs text-muted-foreground">
            {screen.activePlaylist?.name ?? t('noPlaylist')}
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0 rounded-xl">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[11rem] rounded-2xl">
              <DropdownMenuItem onClick={() => onEdit(screen)}>{t('screenSettings')}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-400 focus:text-red-300"
                onClick={() => onDelete(screen.id)}
              >
                {t('deleteScreen')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            type="button"
            size="sm"
            className="h-9 flex-1 rounded-xl bg-white/10 text-[13px] font-semibold backdrop-blur-sm hover:bg-white/15"
            asChild
          >
            <Link href={`/${locale}/studio` as Route}>
              <PenLine className="me-1.5 h-3.5 w-3.5" />
              {t('editDesign')}
            </Link>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 flex-1 rounded-xl border-white/20 bg-white/5 text-[13px] font-medium"
            onClick={() => onRemote(screen.id, 'refresh_content')}
          >
            <RefreshCw className="me-1.5 h-3.5 w-3.5" />
            {t('refresh')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 flex-1 rounded-xl border-red-500/30 bg-red-500/5 text-[13px] font-medium text-red-200 hover:bg-red-500/15"
            onClick={() => onRemote(screen.id, 'restart')}
          >
            <Power className="me-1.5 h-3.5 w-3.5" />
            {t('powerOff')}
          </Button>
        </div>
      </div>
    </motion.article>
  );
}

export function ScreensClient({ locale }: Props) {
  const t = useTranslations('screensClient');
  const { workspaceId, bumpWorkspaceDataEpoch } = useWorkspace();
  const { screens, setScreens, isLoading, reload } = useApiScreens(workspaceId);
  useScreenRealtime(workspaceId, setScreens);
  const [selected, setSelected] = useState<ScreenRow | null>(null);
  const [openAdd, setOpenAdd] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickScreen, setQuickScreen] = useState<ScreenRow | null>(null);

  const onDelete = useCallback(
    async (id: string) => {
      if (!workspaceId) return;
      const response = await apiFetch(
        `/screens/${id}?workspaceId=${encodeURIComponent(workspaceId)}`,
        { method: 'DELETE' },
      );
      if (!response.ok) {
        toast.error(t('deleteFailed'));
        return;
      }
      toast.success(t('deleted'));
      await reload();
      bumpWorkspaceDataEpoch();
    },
    [reload, workspaceId, bumpWorkspaceDataEpoch, t],
  );

  const sendRemoteCommand = useCallback(
    async (screenId: string, command: 'identify' | 'refresh_content' | 'restart') => {
      if (!workspaceId) return;
      const response = await apiFetch(
        `/screens/${screenId}/remote-command?workspaceId=${encodeURIComponent(workspaceId)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command }),
        },
      );
      if (!response.ok) {
        toast.error(t('remoteFailed'));
        return;
      }
      toast.success(
        command === 'refresh_content'
          ? t('remoteRefreshOk')
          : t('remotePowerOk'),
      );
    },
    [workspaceId, t],
  );

  const openQuick = (s: ScreenRow) => {
    setQuickScreen(s);
    setQuickOpen(true);
  };

  if (!workspaceId) {
    return (
      <p className="text-[15px] text-muted-foreground">{t('selectWorkspace')}</p>
    );
  }

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="vc-glass vc-card-surface flex flex-col gap-4 rounded-3xl border border-[rgba(147,51,234,0.22)] p-6 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <p className="vc-page-kicker">{t('fleet')}</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">{t('title')}</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-mono-nums text-xs text-muted-foreground">
            <span className="text-foreground">{new Intl.NumberFormat(locale).format(screens.length)}</span> {t('screensCount')}
          </p>
          <Button variant="outline" className="rounded-2xl" onClick={() => void reload()}>
            {t('refresh')}
          </Button>
          <Dialog open={openAdd} onOpenChange={setOpenAdd}>
            <DialogTrigger asChild>
              <Button className="rounded-2xl bg-gradient-to-r from-[#FF6B00] to-[#CC4400] font-semibold shadow-lg shadow-[#0F1729]/30">
                <Plus className="me-2 h-4 w-4" />
                {t('addScreen')}
              </Button>
            </DialogTrigger>
            <CreateScreenDialogContent
              workspaceId={workspaceId}
              onSuccess={async () => {
                setOpenAdd(false);
                await reload();
                bumpWorkspaceDataEpoch();
              }}
            />
          </Dialog>
        </div>
      </motion.div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      ) : screens.length === 0 ? (
        <div className="vc-card-surface flex flex-col items-center gap-4 rounded-3xl py-16">
          <Monitor className="h-12 w-12 text-[#0F1729]/40" />
          <p className="font-medium text-foreground">{t('emptyTitle')}</p>
          <p className="max-w-md text-center text-sm text-muted-foreground">
            {t('emptyDescription')}
          </p>
          <DemoDataButton onDone={() => void reload()} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {screens.map((screen, i) => (
            <ScreenVisualCard
              key={screen.id}
              screen={screen}
              locale={locale}
              workspaceId={workspaceId}
              index={i}
              onCardClick={openQuick}
              onEdit={(s) => {
                setSelected(s);
                setOpenEdit(true);
              }}
              onDelete={(id) => void onDelete(id)}
              onRemote={(id, cmd) => void sendRemoteCommand(id, cmd)}
            />
          ))}
        </div>
      )}

      <ScreenQuickEditPanel
        open={quickOpen}
        onOpenChange={setQuickOpen}
        screen={quickScreen}
        workspaceId={workspaceId}
        locale={locale}
        onSaved={reload}
        onEditScreen={() => {
          if (quickScreen) {
            setSelected(quickScreen);
            setOpenEdit(true);
          }
        }}
      />

      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        {selected ? (
          <EditScreenDialogContent
            screen={selected}
            workspaceId={workspaceId}
            onSuccess={async () => {
              setOpenEdit(false);
              setSelected(null);
              await reload();
            }}
          />
        ) : null}
      </Dialog>
    </div>
  );
}

function CreateScreenDialogContent({
  workspaceId,
  onSuccess,
}: {
  workspaceId: string;
  onSuccess: () => Promise<void>;
}) {
  const t = useTranslations('screensClient.dialogs');
  const form = useForm<z.infer<typeof screenSchema>>({
    resolver: zodResolver(screenSchema),
    defaultValues: {
      name: '',
      serialNumber: '',
      location: '',
    },
  });

  const submit = async (values: z.infer<typeof screenSchema>) => {
    const response = await apiFetch('/screens', {
      method: 'POST',
      body: JSON.stringify({
        workspaceId,
        ...values,
      }),
    });
    if (!response.ok) {
      toast.error(t('createFailed'));
      return;
    }
    toast.success(t('createSuccess'));
    form.reset();
    await onSuccess();
  };

  return (
    <DialogContent className="rounded-3xl border-border/80 sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{t('addTitle')}</DialogTitle>
        <DialogDescription>{t('addDescription')}</DialogDescription>
      </DialogHeader>
      <form className="space-y-4" onSubmit={form.handleSubmit(submit)}>
        <FieldInput label={t('screenName')} error={form.formState.errors.name?.message}>
          <Input {...form.register('name')} className="rounded-xl" />
        </FieldInput>
        <FieldInput label={t('serialNumber')} error={form.formState.errors.serialNumber?.message}>
          <Input {...form.register('serialNumber')} className="font-mono-nums rounded-xl" />
        </FieldInput>
        <FieldInput label={t('location')} error={form.formState.errors.location?.message}>
          <Input {...form.register('location')} className="rounded-xl" />
        </FieldInput>
        <DialogFooter>
          <Button type="submit" className="rounded-2xl bg-[#0F1729] hover:bg-[#0F1729]/90">
            {t('create')}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function EditScreenDialogContent({
  screen,
  workspaceId,
  onSuccess,
}: {
  screen: ScreenRow;
  workspaceId: string;
  onSuccess: () => Promise<void>;
}) {
  const t = useTranslations('screensClient.dialogs');
  const form = useForm<z.infer<typeof editSchema>>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: screen.name,
      serialNumber: screen.serialNumber,
      location: screen.location ?? '',
      status: screen.status,
    },
  });

  const submit = async (values: z.infer<typeof editSchema>) => {
    const response = await apiFetch(
      `/screens/${screen.id}?workspaceId=${encodeURIComponent(workspaceId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          name: values.name,
          location: values.location,
          status: values.status,
        }),
      },
    );
    if (!response.ok) {
      toast.error(t('updateFailed'));
      return;
    }
    toast.success(t('updateSuccess'));
    await onSuccess();
  };

  return (
    <DialogContent className="rounded-3xl border-border/80 sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{t('editTitle')}</DialogTitle>
        <DialogDescription>{t('editDescription')}</DialogDescription>
      </DialogHeader>
      <form className="space-y-4" onSubmit={form.handleSubmit(submit)}>
        <FieldInput label={t('screenName')} error={form.formState.errors.name?.message}>
          <Input {...form.register('name')} className="rounded-xl" />
        </FieldInput>
        <FieldInput label={t('serialNumber')}>
          <Input {...form.register('serialNumber')} disabled className="font-mono-nums rounded-xl" />
        </FieldInput>
        <FieldInput label={t('location')} error={form.formState.errors.location?.message}>
          <Input {...form.register('location')} className="rounded-xl" />
        </FieldInput>
        <FieldInput label={t('status')} error={form.formState.errors.status?.message}>
          <select
            className="h-11 w-full rounded-xl border border-border bg-card px-4 text-[15px] text-foreground outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
            {...form.register('status')}
          >
            <option value="ONLINE">{t('online')}</option>
            <option value="OFFLINE">{t('offline')}</option>
            <option value="MAINTENANCE">{t('maintenance')}</option>
          </select>
        </FieldInput>
        <DialogFooter>
          <Button type="submit" className="rounded-2xl bg-[#0F1729] hover:bg-[#0F1729]/90">
            {t('save')}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function FieldInput({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
