import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

export type BadgeTone =
  'neutral' | 'primary' | 'info' | 'success' | 'warning' | 'danger' | 'violet';

const TONES: Record<BadgeTone, { badge: string; dot: string }> = {
  neutral: { badge: 'border-border bg-surface-muted text-foreground-secondary', dot: 'bg-muted' },
  primary: { badge: 'border-primary-soft-border bg-primary-soft text-accent', dot: 'bg-accent' },
  info: { badge: 'border-info-border bg-info-soft text-info', dot: 'bg-info' },
  success: { badge: 'border-success-border bg-success-soft text-success', dot: 'bg-success' },
  warning: { badge: 'border-warning-border bg-warning-soft text-warning', dot: 'bg-warning' },
  danger: { badge: 'border-danger-border bg-danger-soft text-danger', dot: 'bg-danger' },
  violet: { badge: 'border-violet-border bg-violet-soft text-violet', dot: 'bg-violet' },
};

interface BadgeProps {
  tone?: BadgeTone;
  /** A leading status dot. Color is never the only signal: the label is always shown. */
  dot?: boolean;
  /** `sm` for dense rows; `md` (default) elsewhere. */
  size?: 'sm' | 'md';
  className?: string;
  children: ReactNode;
}

/** The solid dot color of each tone, for status indicators outside a badge. */
export function badgeDotClass(tone: BadgeTone): string {
  return TONES[tone].dot;
}

export function Badge({ tone = 'neutral', dot, size = 'md', className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm border font-medium whitespace-nowrap',
        size === 'sm' ? 'h-5 px-1.5 text-2xs' : 'h-6 px-2 text-xs',
        TONES[tone].badge,
        className,
      )}
    >
      {dot ? (
        <span className={cn('size-1.5 shrink-0 rounded-full', TONES[tone].dot)} aria-hidden />
      ) : null}
      {children}
    </span>
  );
}
