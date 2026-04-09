'use client';

import { useState } from 'react';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  apiFetch,
  readApiErrorMessage,
  setStoredAccessToken,
} from './session';
import { useWorkspace } from '@/features/workspace/workspace-context';
import { cn } from '@/lib/utils';

type LoginFormProps = {
  locale: string;
  /** Dark glass login page (full-screen auth). */
  variant?: 'default' | 'dark';
  /** Split hero + form layout (login page provides columns). */
  layout?: 'card' | 'split';
};

type AuthSuccessPayload = {
  user?: { isSuperAdmin?: boolean };
  workspaces?: Array<{ id: string; name: string; role: string }>;
  accessToken?: string;
};

const showDevTools =
  process.env.NODE_ENV === 'development' ||
  process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN === 'true';

const glassInputDark =
  'h-12 rounded-xl border border-white/10 bg-[#1B254B]/55 text-[15px] text-white shadow-inner shadow-black/40 backdrop-blur-xl placeholder:text-white/35 focus-visible:border-[#FF6B00]/55 focus-visible:ring-2 focus-visible:ring-[#FF6B00]/25';

export function LoginForm({
  locale,
  variant = 'default',
  layout = 'card',
}: LoginFormProps) {
  const t = useTranslations('authForm');
  const activeLocale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setWorkspaceId, refreshWorkspaces } = useWorkspace();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyAuthSuccess = async (payload: AuthSuccessPayload) => {
    if (payload.accessToken) {
      setStoredAccessToken(payload.accessToken);
    }
    const workspaceId = payload.workspaces?.[0]?.id;
    if (workspaceId) {
      setWorkspaceId(workspaceId);
    }
    await refreshWorkspaces(workspaceId ?? null);
    toast.success(t('signedIn'));
    const returnTo = searchParams.get('returnTo');
    const isSuper = Boolean(payload.user?.isSuperAdmin);
    let dest: string;
    if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')) {
      dest = returnTo;
    } else if (isSuper) {
      dest = `/${activeLocale}/overview`;
    } else if (workspaceId) {
      dest = `/${activeLocale}/media`;
    } else {
      dest = `/${activeLocale}`;
    }
    router.push(dest as Route);
    router.refresh();
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      setStoredAccessToken(null);
      const response = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        omitAuth: true,
      });
      if (!response.ok) {
        const detail = await readApiErrorMessage(response);
        throw new Error(detail);
      }

      const payload = (await response.json()) as AuthSuccessPayload;
      await applyAuthSuccess(payload);
    } catch (e) {
      const message = e instanceof Error ? e.message : t('loginFailed');
      setError(message);
      toast.error(message);
    } finally {
      setPending(false);
    }
  };

  const onDevLogin = async () => {
    setPending(true);
    setError(null);
    try {
      setStoredAccessToken(null);
      const response = await apiFetch('/auth/dev-login', {
        method: 'POST',
        omitAuth: true,
      });
      if (!response.ok) {
        const detail = await readApiErrorMessage(response);
        throw new Error(detail || t('devLoginFailed'));
      }
      const payload = (await response.json()) as AuthSuccessPayload;
      await applyAuthSuccess(payload);
    } catch (e) {
      const message = e instanceof Error ? e.message : t('devLoginFailed');
      setError(message);
      toast.error(message);
    } finally {
      setPending(false);
    }
  };

  const dark = variant === 'dark';
  const split = layout === 'split' && dark;

  return (
    <div className="space-y-6">
      <form className="space-y-5" onSubmit={onSubmit}>
        <div className="space-y-2">
          <label
            className={cn(
              'text-[13px] font-medium',
              dark ? 'text-white/75' : 'text-foreground',
            )}
            htmlFor="email"
          >
            {t('email')}
          </label>
          <Input
            id="email"
            type="text"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="username"
            placeholder={t('emailPlaceholder')}
            className={cn(split ? glassInputDark : dark ? glassInputDark : undefined)}
          />
        </div>
        <div className="space-y-2">
          <label
            className={cn(
              'text-[13px] font-medium',
              dark ? 'text-white/75' : 'text-foreground',
            )}
            htmlFor="password"
          >
            {t('password')}
          </label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
            className={cn(split ? glassInputDark : dark ? glassInputDark : undefined)}
          />
        </div>
        {error ? (
          <p
            className={cn(
              'text-sm',
              dark ? 'text-red-300' : 'text-red-600 dark:text-red-400',
            )}
          >
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-between gap-2 text-xs">
          <Link
            href={`/${activeLocale}/forgot-password` as Route}
            className={dark ? 'text-[#FF6B00]/90 hover:underline' : 'text-primary hover:underline'}
          >
            {t('forgotPassword')}
          </Link>
          <Link
            href={`/${activeLocale}/register` as Route}
            className={dark ? 'text-white/50 hover:text-white/80' : 'text-muted-foreground hover:text-foreground'}
          >
            {t('createAccount')}
          </Link>
        </div>
        <Button
          className={
            dark
              ? 'h-12 w-full rounded-xl bg-gradient-to-r from-[#FF6B00] to-[#CC4400] font-semibold text-white shadow-lg shadow-[#FF6B00]/25 hover:opacity-[0.97]'
              : 'w-full'
          }
          type="submit"
          variant={dark ? 'default' : 'cta'}
          disabled={pending}
        >
          {pending ? t('signingIn') : t('signIn')}
        </Button>
      </form>

      {showDevTools ? (
        <div
          className={
            dark
              ? 'rounded-2xl border border-dashed border-[#FF6B00]/30 bg-[#FF6B00]/[0.06] p-4'
              : 'rounded-2xl border border-dashed border-[#FF6B00]/40 bg-[#FF6B00]/5 p-4'
          }
        >
          <p
            className={
              dark
                ? 'text-xs font-medium text-[#FF6B00]/90'
                : 'text-xs font-medium text-[#CC4400] dark:text-[#FF6B00]/90'
            }
          >
            {t('debugDevOnly')}
          </p>
          <Button
            type="button"
            variant="outline"
            className={
              dark
                ? 'mt-3 w-full rounded-xl border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.08]'
                : 'mt-3 w-full rounded-xl border-amber-500/50'
            }
            disabled={pending}
            onClick={() => void onDevLogin()}
          >
            {t('forceLoginSeed')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
