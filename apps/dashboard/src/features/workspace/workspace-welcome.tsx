'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Loader2, Sparkles, Wand2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiFetch, consumePendingWorkspaceCreate } from '@/features/auth/session';
import { useWorkspace } from '@/features/workspace/workspace-context';
import { WorkspaceCreateDialog } from '@/features/workspace/workspace-create-dialog';

export function WorkspaceWelcome() {
  const t = useTranslations('workspaceWelcome');
  const { refreshWorkspaces, setWorkspaceId, bumpWorkspaceDataEpoch } = useWorkspace();
  const [createOpen, setCreateOpen] = useState(false);
  const [booting, setBooting] = useState(false);

  useEffect(() => {
    if (consumePendingWorkspaceCreate()) {
      setCreateOpen(true);
      toast.info(t('sessionRestored'));
    }
  }, []);

  const runBootstrap = async () => {
    setBooting(true);
    try {
      const res = await apiFetch('/workspaces/bootstrap-demo', { method: 'POST' });
      let data: { workspace?: { id: string }; message?: string } = {};
      try {
        data = (await res.json()) as { workspace?: { id: string }; message?: string };
      } catch {
        /* non-JSON */
      }
      if (!res.ok) {
        const msg =
          data && typeof data === 'object' && 'message' in data && data.message
            ? String(data.message)
            : t('demoCreateFailed');
        toast.error(msg);
        return;
      }
      toast.success(data.message ?? t('demoWorkspaceReady'));
      const wid = data.workspace?.id;
      await refreshWorkspaces(wid ?? null);
      if (wid) setWorkspaceId(wid);
      bumpWorkspaceDataEpoch();
    } catch {
      toast.error(t('requestFailed'));
    } finally {
      setBooting(false);
    }
  };

  return (
    <>
      <div className="flex min-h-[calc(100vh-14rem)] flex-col items-center justify-center px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="vc-glass vc-card-surface relative max-w-lg overflow-hidden rounded-[2rem] p-10 text-center shadow-2xl"
        >
          <div className="pointer-events-none absolute -start-20 -top-20 h-56 w-56 rounded-full bg-[#0F1729]/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -end-16 h-48 w-48 rounded-full bg-[#FF6B00]/15 blur-3xl" />

          <div className="relative mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-[#0F1729] to-[#0c1220] shadow-xl shadow-[#0F1729]/40">
            <Sparkles className="h-11 w-11 text-[#FF6B00]" strokeWidth={1.5} />
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {t('title')}
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
            {t('description')}
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button
              type="button"
              size="lg"
              className="h-12 rounded-2xl bg-[#0F1729] px-8 text-base font-semibold text-white shadow-lg shadow-[#0F1729]/35 hover:bg-[#0F1729]/90"
              onClick={() => setCreateOpen(true)}
            >
              <Building2 className="me-2 h-5 w-5" />
              {t('createFirstWorkspace')}
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="h-12 rounded-2xl border-[#FF6B00]/40 bg-[#FF6B00]/10 font-semibold text-foreground hover:bg-[#FF6B00]/20"
              onClick={() => void runBootstrap()}
              disabled={booting}
            >
              {booting ? (
                <Loader2 className="me-2 h-5 w-5 animate-spin" />
              ) : (
                <Wand2 className="me-2 h-5 w-5 text-amber-700 dark:text-[#FF6B00]" />
              )}
              {t('loadDemoData')}
            </Button>
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            {t('demoFootnote')}
          </p>
        </motion.div>
      </div>

      <WorkspaceCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
