'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiFetch } from '@/features/auth/session';
import { useWorkspace } from '@/features/workspace/workspace-context';

type Me = {
  id: string;
  email: string;
  fullName: string;
  businessName?: string | null;
  phone?: string | null;
};

export function SettingsProfileClient() {
  const t = useTranslations('settingsProfileClient');
  const { refreshWorkspaces } = useWorkspace();
  const [data, setData] = useState<Me | null>(null);
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [emailStep, setEmailStep] = useState<'request' | 'verify'>('request');

  const load = useCallback(async () => {
    const res = await apiFetch('/auth/me');
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const me = (await res.json()) as Me & { businessName?: string | null; phone?: string | null };
    setData(me);
    setFullName(me.fullName);
    setBusinessName(me.businessName ?? '');
    setPhone(me.phone ?? '');
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const res = await apiFetch('/account/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          fullName: fullName.trim(),
          businessName: businessName.trim(),
          phone: phone.trim(),
        }),
      });
      if (!res.ok) throw new Error(t('updateFailed'));
      toast.success(t('saved'));
      await load();
      await refreshWorkspaces();
    } catch {
      toast.error(t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const requestEmailChange = async () => {
    const res = await apiFetch('/account/email/request', {
      method: 'POST',
      body: JSON.stringify({ newEmail: newEmail.trim() }),
    });
    if (!res.ok) {
      toast.error(t('emailRequestFailed'));
      return;
    }
    toast.success(t('emailRequestSent'));
    setEmailStep('verify');
  };

  const verifyEmailChange = async () => {
    const res = await apiFetch('/account/email/verify', {
      method: 'POST',
      body: JSON.stringify({ newEmail: newEmail.trim(), code: emailOtp }),
    });
    if (!res.ok) {
      toast.error(t('invalidCode'));
      return;
    }
    toast.success(t('emailUpdated'));
    setEmailOpen(false);
    setEmailStep('request');
    setNewEmail('');
    setEmailOtp('');
    await load();
    await refreshWorkspaces();
  };

  if (loading || !data) return <p className="text-sm text-muted-foreground">{t('loading')}</p>;

  return (
    <div className="space-y-8">
      <div className="vc-card-surface rounded-3xl border border-[#0F1729]/20 bg-gradient-to-br from-[#0F1729]/12 via-card/30 to-transparent p-6 shadow-[0_0_60px_-24px_rgba(10,15,29,0.45)] backdrop-blur-xl md:p-8">
        <h2 className="text-lg font-semibold tracking-tight">{t('title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('fullName')}</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label>{t('businessName')}</Label>
            <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="rounded-xl" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>{t('phone')}</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded-xl" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>{t('email')}</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input value={data.email} readOnly className="rounded-xl font-mono text-sm" />
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setEmailOpen(true)}>
                {t('changeEmail')}
              </Button>
            </div>
          </div>
        </div>
        <Button
          type="button"
          className="mt-6 rounded-2xl bg-gradient-to-r from-[#FF6B00] to-[#CC4400] font-semibold text-white shadow-lg shadow-[#0F1729]/25"
          disabled={saving}
          onClick={() => void saveProfile()}
        >
          {t('saveChanges')}
        </Button>
      </div>

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('verifyNewEmail')}</DialogTitle>
          </DialogHeader>
          {emailStep === 'request' ? (
            <>
              <div className="space-y-2 py-2">
                <Label>{t('newEmail')}</Label>
                <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} type="email" className="rounded-xl" />
              </div>
              <DialogFooter>
                <Button type="button" className="rounded-2xl" onClick={() => void requestEmailChange()}>
                  {t('sendCode')}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="space-y-2 py-2">
                <Label>{t('code6Digits')}</Label>
                <Input
                  value={emailOtp}
                  onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="rounded-xl font-mono text-center text-lg tracking-widest"
                  maxLength={6}
                />
              </div>
              <DialogFooter>
                <Button type="button" className="rounded-2xl" onClick={() => void verifyEmailChange()}>
                  {t('confirmEmail')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
