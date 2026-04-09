'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AdminCosmicLoader } from '@/components/admin/admin-cosmic-loader';
import { apiFetch, readApiErrorMessage } from '@/features/auth/session';
import { toast } from 'sonner';

type SettingsPayload = {
  platformName?: string;
  supportEmail?: string;
  maintenanceMode?: boolean;
  defaultLanguage?: string;
  logoUrlEn?: string;
  logoUrlAr?: string;
};

const BRANDING_VARIANTS = [
  { key: 'en-light', labelKey: 'uploadEnLight' as const },
  { key: 'en-dark', labelKey: 'uploadEnDark' as const },
  { key: 'ar-light', labelKey: 'uploadArLight' as const },
  { key: 'ar-dark', labelKey: 'uploadArDark' as const },
] as const;

export function AdminSettingsClient() {
  const t = useTranslations('adminSettings');
  const [form, setForm] = useState({
    platformName: '',
    supportEmail: '',
    maintenanceMode: false,
    defaultLanguage: 'ar',
    logoUrlEn: '',
    logoUrlAr: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const res = await apiFetch('/admin/settings');
      if (!res.ok) {
        if (mounted) setLoading(false);
        return;
      }
      const data = (await res.json()) as SettingsPayload;
      if (mounted) {
        setForm({
          platformName: data.platformName ?? '',
          supportEmail: data.supportEmail ?? '',
          maintenanceMode: Boolean(data.maintenanceMode),
          defaultLanguage: data.defaultLanguage ?? 'ar',
          logoUrlEn: data.logoUrlEn ?? '',
          logoUrlAr: data.logoUrlAr ?? '',
        });
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await apiFetch('/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        toast.error(await readApiErrorMessage(res));
        return;
      }
      toast.success(t('saved'));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('branding-updated'));
      }
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async (variant: string, file: File | null) => {
    if (!file) return;
    setUploading(variant);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiFetch(
        `/admin/settings/branding/upload?variant=${encodeURIComponent(variant)}`,
        { method: 'POST', body: fd },
      );
      if (!res.ok) {
        toast.error(await readApiErrorMessage(res));
        return;
      }
      toast.success(t('branding.uploadSuccess'));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('branding-updated'));
      }
    } finally {
      setUploading(null);
    }
  };

  if (loading) return <AdminCosmicLoader label={t('loading')} />;

  return (
    <div className="space-y-6">
      <section className="vc-card-surface rounded-3xl border border-[#FF6B00]/15 p-5">
        <h3 className="mb-4 text-base font-semibold">{t('general.title')}</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label>{t('general.platformName')}</Label>
            <Input
              value={form.platformName}
              onChange={(e) => setForm((f) => ({ ...f, platformName: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label>{t('general.supportEmail')}</Label>
            <Input
              value={form.supportEmail}
              onChange={(e) => setForm((f) => ({ ...f, supportEmail: e.target.value }))}
            />
          </div>
        </div>
      </section>

      <section className="vc-card-surface rounded-3xl border border-[#FF6B00]/15 p-5">
        <h3 className="mb-2 text-base font-semibold">{t('branding.title')}</h3>
        <p className="mb-6 text-sm text-muted-foreground">{t('branding.description')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {BRANDING_VARIANTS.map((v) => (
            <div key={v.key} className="space-y-2">
              <Label>{t(`branding.${v.labelKey}`)}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="cursor-pointer text-sm"
                  disabled={uploading === v.key}
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    void uploadLogo(v.key, file);
                    e.target.value = '';
                  }}
                />
                {uploading === v.key ? (
                  <span className="text-xs text-muted-foreground">…</span>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 border-t border-border/60 pt-6">
          <h4 className="mb-3 text-sm font-semibold text-muted-foreground">
            {t('branding.legacyTitle')}
          </h4>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label>{t('branding.logoUrlEn')}</Label>
              <Input
                value={form.logoUrlEn}
                onChange={(e) => setForm((f) => ({ ...f, logoUrlEn: e.target.value }))}
                placeholder={t('branding.urlPlaceholder')}
              />
            </div>
            <div className="space-y-1">
              <Label>{t('branding.logoUrlAr')}</Label>
              <Input
                value={form.logoUrlAr}
                onChange={(e) => setForm((f) => ({ ...f, logoUrlAr: e.target.value }))}
                placeholder={t('branding.urlPlaceholder')}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="vc-card-surface rounded-3xl border border-[#FF6B00]/15 p-5">
        <h3 className="mb-4 text-base font-semibold">{t('security.title')}</h3>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.maintenanceMode}
            onChange={(e) => setForm((f) => ({ ...f, maintenanceMode: e.target.checked }))}
          />
          {t('security.maintenanceMode')}
        </label>
      </section>

      <section className="vc-card-surface rounded-3xl border border-[#FF6B00]/15 p-5">
        <h3 className="mb-4 text-base font-semibold">{t('localization.title')}</h3>
        <div className="max-w-xs space-y-1">
          <Label>{t('localization.defaultLanguage')}</Label>
          <select
            className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm"
            value={form.defaultLanguage}
            onChange={(e) => setForm((f) => ({ ...f, defaultLanguage: e.target.value }))}
          >
            <option value="ar">{t('localization.langAr')}</option>
            <option value="en">{t('localization.langEn')}</option>
          </select>
        </div>
      </section>

      <Button
        className="bg-[#FF6B00] text-amber-950 hover:bg-[#FF6B00]/90"
        disabled={saving}
        onClick={() => void save()}
      >
        {t('save')}
      </Button>
    </div>
  );
}
