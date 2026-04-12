'use client';

import { useTranslations } from 'next-intl';
import {
  ChevronDown,
  Clapperboard,
  Image as ImageIcon,
  Link2,
  Monitor,
  Plus,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ICON_STROKE } from '@/lib/icon-stroke';
import { cn } from '@/lib/utils';

export type BranchTab = 'playlists' | 'screens' | 'media';

type Props = {
  activeTab: BranchTab;
  onTabChange: (tab: BranchTab) => void;
  onNewPlaylist: () => void;
  onNewScreen: () => void;
  onNewMedia: () => void;
  onOpenPairingModal: () => void;
  /** Compact row for shell header (no large card wrapper). */
  variant?: 'default' | 'inline';
};

const tabButtonClass = (active: boolean, inline: boolean) =>
  cn(
    'inline-flex items-center gap-2 rounded-xl border font-semibold transition',
    inline
      ? 'px-2.5 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm'
      : 'px-3.5 py-2.5 text-sm',
    active
      ? 'border-[#FF6B00]/55 bg-[#FF6B00]/18 text-white'
      : 'border-[#FF6B00]/25 bg-white/60 text-[#1B254B] hover:border-[#FF6B00]/50 hover:bg-[#FF6B00]/10 dark:border-white/15 dark:bg-[#1B254B]/50 dark:text-white dark:hover:bg-[#FF6B00]/15',
  );

export function BranchWorkspaceToolbar({
  activeTab,
  onTabChange,
  onNewPlaylist,
  onNewScreen,
  onNewMedia,
  onOpenPairingModal,
  variant = 'default',
}: Props) {
  const t = useTranslations('branchToolbar');
  const inline = variant === 'inline';

  const tabs = [
    { key: 'playlists' as const, label: t('playlists'), icon: Clapperboard },
    { key: 'screens' as const, label: t('screens'), icon: Monitor },
    { key: 'media' as const, label: t('media'), icon: ImageIcon },
  ] as const;

  const iconClass = cn('shrink-0 text-[#FF6B00]', inline ? 'h-3.5 w-3.5 sm:h-4 sm:w-4' : 'h-4 w-4');

  const inner = (
    <div
      className={cn(
        'flex flex-wrap items-center gap-1.5 sm:gap-2',
        inline ? 'justify-end' : 'justify-center gap-2',
      )}
      aria-label={t('navAria')}
    >
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onTabChange(tab.key)}
          className={tabButtonClass(activeTab === tab.key, inline)}
        >
          <tab.icon className={iconClass} strokeWidth={ICON_STROKE} />
          {tab.label}
        </button>
      ))}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={tabButtonClass(false, inline)}
            aria-label={t('actionsMenuAria')}
          >
            <Plus className={iconClass} strokeWidth={ICON_STROKE} />
            {t('actionsMenu')}
            <ChevronDown className={cn(iconClass, 'opacity-80')} strokeWidth={ICON_STROKE} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={inline ? 'end' : 'center'} className="min-w-[14rem]">
          <DropdownMenuItem className="gap-2 font-semibold" onClick={() => onNewPlaylist()}>
            <Clapperboard className="h-4 w-4 text-[#FF6B00]" strokeWidth={ICON_STROKE} />
            {t('newPlaylist')}
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 font-semibold" onClick={() => onNewScreen()}>
            <Monitor className="h-4 w-4 text-[#FF6B00]" strokeWidth={ICON_STROKE} />
            {t('newScreen')}
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 font-semibold" onClick={() => onNewMedia()}>
            <ImageIcon className="h-4 w-4 text-[#FF6B00]" strokeWidth={ICON_STROKE} />
            {t('newMedia')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2 font-semibold" onClick={() => onOpenPairingModal()}>
            <Link2 className="h-4 w-4 text-[#FF6B00]" strokeWidth={ICON_STROKE} />
            {t('linkDisplay')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  if (inline) {
    return inner;
  }

  return (
    <div className="flex w-full justify-center px-0">
      <div
        className={cn(
          'inline-flex w-full max-w-max flex-col gap-3 rounded-3xl border border-[#FF6B00]/12 bg-gradient-to-br from-[#0F1729]/40 via-transparent to-[#FF6B00]/[0.06] p-4 sm:flex-row sm:items-center sm:gap-2',
          'dark:border-white/10 dark:from-[#0B1220]/80',
        )}
      >
        {inner}
      </div>
    </div>
  );
}
