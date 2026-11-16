import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

export type BadgeTone =
  'neutral' | 'primary' | 'info' | 'success' | 'warning' | 'danger' | 'violet';

const TONES: Record<BadgeTone, { badge: string; dot: string }> = {
  neutral: {
    badge: 'bg-surface-muted text-foreground-secondary ring-border-strong/60',
    dot: 'bg-muted',
  },
  primary: { badge: 'bg-primary-soft text-accent ring-primary-soft-border', dot: 'bg-accent' },
  info: { badge: 'bg-info-soft text-info ring-info-border', dot: 'bg-info' },
  success: { badge: 'bg-success-soft text-success ring-success-border', dot: 'bg-success' },
  warning: { badge: 'bg-warning-soft text-warning ring-warning-border', dot: 'bg-warning' },
  danger: { badge: 'bg-danger-soft text-danger ring-danger-border', dot: 'bg-danger' },
  violet: { badge: 'bg-violet-soft text-violet ring-violet-border', dot: 'bg-violet' },
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

/** A pill-shaped label with a hairline ring in its tone. */
export function Badge({ tone = 'neutral', dot, size = 'md', className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap ring-1 ring-inset',
        size === 'sm' ? 'h-5 px-2 text-2xs' : 'h-6 px-2.5 text-xs',
        TONES[tone].badge,
        className,
      )}
    >
      {dot ? (
        <span className="relative flex size-1.5 shrink-0" aria-hidden>
          <span
            className={cn('absolute inset-0 rounded-full opacity-35 blur-[2px]', TONES[tone].dot)}
          />
          <span className={cn('relative size-1.5 rounded-full', TONES[tone].dot)} />
        </span>
      ) : null}
      {children}
    </span>
  );
}
