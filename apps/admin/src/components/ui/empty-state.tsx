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
      className={cn(
        'relative isolate flex flex-col items-center overflow-hidden text-center',
        compact ? 'px-4 py-9' : 'px-6 py-20',
      )}
    >
      {compact ? null : (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 grid-dots opacity-80"
        />
      )}
      <span
        className={cn(
          'relative mb-5 flex items-center justify-center rounded-2xl bg-surface text-accent',
          'shadow-[0_0_0_1px_var(--border),0_10px_30px_-10px_var(--focus-ring)]',
          compact ? 'size-11' : 'size-14',
        )}
      >
        {/* Concentric rings that frame the icon. */}
        <span aria-hidden className="absolute -inset-2.5 rounded-[22px] border border-border/80" />
        {compact ? null : (
          <span
            aria-hidden
            className="absolute -inset-5 rounded-[28px] border border-dashed border-border/70"
          />
        )}
        <Icon name={icon} className={compact ? 'size-5' : 'size-6'} />
      </span>
      <p
        className={cn(
          'mt-1 font-semibold tracking-tight text-foreground',
          compact ? 'text-base' : 'text-lg',
        )}
      >
        {title}
      </p>
      {description ? (
        <p className={cn('mt-1.5 max-w-md text-muted', compact ? 'text-sm' : 'text-base')}>
          {description}
        </p>
      ) : null}
      {children ? (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">{children}</div>
      ) : null}
    </div>
  );
}
