import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { Icon, type IconName } from './icon';

interface EmptyStateProps {
  icon?: IconName;
  title: string;
  description?: string;
  /** `compact` for empty sections inside a page; `default` for a whole empty page or table. */
  size?: 'default' | 'compact';
  /** Extra content under the description: badges, notes or a call to action. */
  children?: ReactNode;
}

/** Shown when there is nothing to display yet. Never filled with placeholder data. */
export function EmptyState({
  icon = 'inbox',
  title,
  description,
  size = 'default',
  children,
}: EmptyStateProps) {
  const compact = size === 'compact';
  return (
    <div
      className={cn('flex flex-col items-center text-center', compact ? 'px-4 py-8' : 'px-6 py-16')}
    >
      <span
        className={cn(
          'relative mb-4 flex items-center justify-center rounded-xl border border-border bg-surface text-muted shadow-sm',
          compact ? 'size-10' : 'size-12',
        )}
      >
        {/* A faint ring that frames the icon without color. */}
        <span
          aria-hidden
          className="absolute -inset-2 rounded-[16px] border border-dashed border-border"
        />
        <Icon name={icon} className={compact ? 'size-[18px]' : 'size-5'} />
      </span>
      <p className={cn('font-semibold text-foreground', compact ? 'text-base' : 'text-md')}>
        {title}
      </p>
      {description ? (
        <p className={cn('mt-1 max-w-md text-muted', compact ? 'text-sm' : 'text-base')}>
          {description}
        </p>
      ) : null}
      {children ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{children}</div>
      ) : null}
    </div>
  );
}
