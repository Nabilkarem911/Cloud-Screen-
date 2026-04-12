'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  apiFetch,
  parseScreenLimitFromApiMessage,
  readApiErrorMessage,
} from '@/features/auth/session';

type PlaylistRow = { id: string; name: string };

type PlaylistMode = 'none' | 'existing' | 'new';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  onCreated: () => void;
};

export function CreateScreenDialog({ open, onOpenChange, workspaceId, onCreated }: Props) {
  const t = useTranslations('createScreenDialog');
  const [name, setName] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [location, setLocation] = useState('');
  const [playlistMode, setPlaylistMode] = useState<PlaylistMode>('none');
  const [playlists, setPlaylists] = useState<PlaylistRow[]>([]);
  const [existingPlaylistId, setExistingPlaylistId] = useState('');
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadPlaylists = useCallback(async () => {
    if (!workspaceId) return;
    setLoadingPlaylists(true);
    const res = await apiFetch(`/playlists?workspaceId=${encodeURIComponent(workspaceId)}`);
    if (res.ok) {
      const data = (await res.json()) as PlaylistRow[];
      setPlaylists(Array.isArray(data) ? data : []);
    } else {
      setPlaylists([]);
    }
    setLoadingPlaylists(false);
  }, [workspaceId]);

  useEffect(() => {
    if (!open || !workspaceId) return;
    void loadPlaylists();
    setName('');
    setSerialNumber('');
    setLocation('');
    setPlaylistMode('none');
    setExistingPlaylistId('');
    setNewPlaylistName('');
  }, [open, workspaceId, loadPlaylists]);

  const submit = async () => {
    const n = name.trim();
    const sn = serialNumber.trim();
    if (!n || !sn) {
      toast.error(t('validationRequired'));
      return;
    }
    if (playlistMode === 'existing' && !existingPlaylistId) {
      toast.error(t('validationPlaylist'));
      return;
    }
    if (playlistMode === 'new' && !newPlaylistName.trim()) {
      toast.error(t('validationNewPlaylist'));
      return;
    }

    setSubmitting(true);
    try {
      let playlistGroupId: string | null | undefined = undefined;

      if (playlistMode === 'new') {
        const gr = await apiFetch('/playlists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceId, name: newPlaylistName.trim() }),
        });
        if (!gr.ok) {
          toast.error(await readApiErrorMessage(gr));
          return;
        }
        const created = (await gr.json()) as { id: string };
        playlistGroupId = created.id;
      } else if (playlistMode === 'existing') {
        playlistGroupId = existingPlaylistId;
      } else {
        playlistGroupId = undefined;
      }

      const body: Record<string, unknown> = {
        workspaceId,
        name: n,
        serialNumber: sn,
        ...(location.trim() ? { location: location.trim() } : {}),
      };
      if (playlistGroupId !== undefined) {
        body.playlistGroupId = playlistGroupId ?? null;
      }

      const res = await apiFetch('/screens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const msg = await readApiErrorMessage(res);
        const limit = parseScreenLimitFromApiMessage(msg);
        if (limit !== null) {
          toast.error(t('screenLimitReached', { limit }));
        } else {
          toast.error(msg);
        }
        return;
      }
      toast.success(t('success'));
      onOpenChange(false);
      onCreated();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="cs-name">{t('name')}</Label>
            <Input
              id="cs-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-xl"
              placeholder={t('namePlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cs-serial">{t('serial')}</Label>
            <Input
              id="cs-serial"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              className="rounded-xl"
              placeholder={t('serialPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cs-loc">{t('location')}</Label>
            <Input
              id="cs-loc"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="rounded-xl"
              placeholder={t('locationPlaceholder')}
            />
          </div>

          <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/30 p-4 dark:border-white/10">
            <p className="text-sm font-semibold text-foreground">{t('playlistSection')}</p>
            <div className="flex flex-col gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="pmode"
                  checked={playlistMode === 'none'}
                  onChange={() => setPlaylistMode('none')}
                  className="accent-[#FF6B00]"
                />
                {t('playlistNone')}
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="pmode"
                  checked={playlistMode === 'existing'}
                  onChange={() => setPlaylistMode('existing')}
                  className="accent-[#FF6B00]"
                />
                {t('playlistExisting')}
              </label>
              {playlistMode === 'existing' ? (
                <select
                  className="h-11 w-full rounded-xl border border-white/15 bg-background px-3 text-sm"
                  value={existingPlaylistId}
                  onChange={(e) => setExistingPlaylistId(e.target.value)}
                  disabled={loadingPlaylists}
                >
                  <option value="">{loadingPlaylists ? t('loadingPlaylists') : t('pickPlaylist')}</option>
                  {playlists.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              ) : null}
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="pmode"
                  checked={playlistMode === 'new'}
                  onChange={() => setPlaylistMode('new')}
                  className="accent-[#FF6B00]"
                />
                {t('playlistNew')}
              </label>
              {playlistMode === 'new' ? (
                <Input
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  className="rounded-xl"
                  placeholder={t('newPlaylistPlaceholder')}
                />
              ) : null}
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button
            type="button"
            className="rounded-xl bg-[#FF6B00] font-semibold text-amber-950"
            disabled={submitting}
            onClick={() => void submit()}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
