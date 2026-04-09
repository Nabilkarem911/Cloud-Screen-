'use client';

import { useState } from 'react';
import { Loader2, Wand2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/features/auth/session';
import { useWorkspace } from '@/features/workspace/workspace-context';

type Props = {
  label?: string;
  onDone?: () => void;
};

export function DemoDataButton({ label, onDone }: Props) {
  const t = useTranslations('demoDataButton');
  const { workspaceId, bumpWorkspaceDataEpoch } = useWorkspace();
  const [pending, setPending] = useState(false);

  const run = async () => {
    if (!workspaceId) {
      toast.error(t('selectWorkspaceFirst'));
      return;
    }
    setPending(true);
    try {
      const res = await apiFetch(`/workspaces/${workspaceId}/seed-demo`, {
        method: 'POST',
      });
      if (!res.ok) {
        const text = await res.text();
        toast.error(text || t('loadFailed'));
        return;
      }
      toast.success(t('loaded'));
      bumpWorkspaceDataEpoch();
      onDone?.();
    } finally {
      setPending(false);
    }
  };

  if (!workspaceId) return null;

  return (
    <Button
      type="button"
      variant="outline"
      className="rounded-2xl border-[#FF6B00]/40 bg-[#FF6B00]/10 font-semibold text-foreground hover:bg-[#FF6B00]/20"
      disabled={pending}
      onClick={() => void run()}
    >
      {pending ? (
        <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <Wand2 className="me-2 h-4 w-4 text-amber-700 dark:text-[#FF6B00]" aria-hidden />
      )}
      {label ?? t('label')}
    </Button>
  );
}
