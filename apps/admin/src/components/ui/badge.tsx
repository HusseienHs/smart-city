import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

export type BadgeTone =
  'neutral' | 'primary' | 'info' | 'success' | 'warning' | 'danger' | 'violet';

const TONES: Record<BadgeTone, { badge: string; dot: string }> = {
  neutral: { badge: 'border-border bg-surface-muted text-foreground-secondary', dot: 'bg-muted' },
  primary: { badge: 'border-primary-soft-border bg-primary-soft text-primary', dot: 'bg-primary' },
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
  className?: string;
  children: ReactNode;
}

export function Badge({ tone = 'neutral', dot, className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap',
        TONES[tone].badge,
        className,
      )}
    >
      {dot ? <span className={cn('size-1.5 rounded-full', TONES[tone].dot)} aria-hidden /> : null}
      {children}
    </span>
  );
}
