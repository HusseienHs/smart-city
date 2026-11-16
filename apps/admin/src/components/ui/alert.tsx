import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { Icon, type IconName } from './icon';

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

const TONES: Record<AlertTone, { box: string; icon: IconName }> = {
  info: { box: 'border-info-border bg-info-soft text-info', icon: 'info' },
  success: { box: 'border-success-border bg-success-soft text-success', icon: 'checkCircle' },
  warning: { box: 'border-warning-border bg-warning-soft text-warning', icon: 'alert' },
  danger: { box: 'border-danger-border bg-danger-soft text-danger', icon: 'alert' },
};

/**
 * An inline message. Errors are announced immediately (`role="alert"`); other tones politely
 * (`role="status"`).
 */
export function Alert({
  tone = 'info',
  title,
  className,
  children,
}: {
  tone?: AlertTone;
  /** An optional bold first line. */
  title?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'flex animate-fade-in items-start gap-3 rounded-md border px-3.5 py-3 text-sm',
        TONES[tone].box,
        className,
      )}
    >
      <Icon name={TONES[tone].icon} className="mt-0.5 size-4" />
      <div className="min-w-0 flex-1 text-foreground-secondary">
        {title ? <p className="mb-0.5 font-medium text-foreground">{title}</p> : null}
        {children}
      </div>
    </div>
  );
}
