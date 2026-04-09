'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Shield, UserPlus, Users } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/features/auth/session';
import { useWorkspace } from '@/features/workspace/workspace-context';
import { cn } from '@/lib/utils';

type Member = {
  membershipId: string;
  role: string;
  joinedAt: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    locale: string;
    isActive: boolean;
  };
};

const ROLES = ['VIEWER', 'EDITOR', 'ADMIN', 'OWNER'] as const;

export function TeamClient() {
  const t = useTranslations('teamClient');
  const locale = useLocale();
  const { workspaceId } = useWorkspace();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('EDITOR');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const res = await apiFetch(`/workspaces/${workspaceId}/members`);
    if (res.ok) {
      setMembers((await res.json()) as Member[]);
    } else {
      setMembers([]);
    }
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const sendInvite = async () => {
    if (!workspaceId || !email.trim()) {
      toast.error(t('enterEmail'));
      return;
    }
    setSending(true);
    try {
      const res = await apiFetch(`/workspaces/${workspaceId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        toast.error(t('inviteFailed'));
        return;
      }
      toast.success(data.message ?? t('inviteRecorded'));
      setEmail('');
    } finally {
      setSending(false);
    }
  };

  if (!workspaceId) {
    return (
      <p className="text-[15px] text-muted-foreground">{t('selectWorkspace')}</p>
    );
  }

  return (
    <div className="space-y-10">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="vc-glass vc-card-surface overflow-hidden rounded-3xl"
      >
        <div className="border-b border-border/60 bg-gradient-to-r from-[#0F1729]/12 via-transparent to-[#FF6B00]/10 px-8 py-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0F1729] to-[#1e293b] shadow-lg shadow-[#0F1729]/35">
                <Users className="h-7 w-7 text-white" strokeWidth={1.75} />
              </div>
              <div>
                <p className="vc-page-kicker">{t('kicker')}</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight">{t('title')}</h2>
                <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                  {t('description')}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-8 p-8 lg:grid-cols-[1fr_380px]">
          <div>
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Shield className="h-4 w-4 text-[#0F1729]" />
              {t('members')}
            </h3>
            {loading ? (
              <p className="text-sm text-muted-foreground">{t('loading')}</p>
            ) : (
              <ul className="space-y-2">
                {members.map((m) => (
                  <li
                    key={m.membershipId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/20 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{m.user.fullName}</p>
                      <p className="truncate text-sm text-muted-foreground">{m.user.email}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          'rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide',
                          m.role === 'OWNER'
                            ? 'bg-[#FF6B00]/20 text-amber-900 dark:text-amber-100'
                            : 'bg-[#0F1729]/15 text-[#0F1729] dark:text-orange-200',
                        )}
                      >
                        {m.role}
                      </span>
                      <span className="font-mono-nums text-xs text-muted-foreground">
                        {new Date(m.joinedAt).toLocaleDateString(locale)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-3xl border border-[#0F1729]/20 bg-gradient-to-b from-card to-muted/10 p-6 shadow-inner">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <UserPlus className="h-4 w-4 text-[#FF6B00]" />
              {t('inviteTeammate')}
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">{t('email')}</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder={t('emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-role">{t('role')}</Label>
                <select
                  id="invite-role"
                  className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  {ROLES.filter((r) => r !== 'OWNER').map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                className="w-full rounded-2xl bg-gradient-to-r from-[#FF6B00] to-[#CC4400] font-semibold shadow-md"
                onClick={() => void sendInvite()}
                disabled={sending}
              >
                <Mail className="me-2 h-4 w-4" />
                {sending ? t('sending') : t('sendInvite')}
              </Button>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {t('demoHint')}
              </p>
            </div>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
