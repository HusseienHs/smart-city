import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { Icon, type IconName } from './icon';

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

const TONES: Record<AlertTone, { box: string; icon: IconName }> = {
  info: { box: 'border-info-border bg-info-soft text-info', icon: 'info' },
  success: { box: 'border-success-border bg-success-soft text-success', icon: 'check' },
  warning: { box: 'border-warning-border bg-warning-soft text-warning', icon: 'alert' },
  danger: { box: 'border-danger-border bg-danger-soft text-danger', icon: 'alert' },
};

/**
 * An inline message. Errors are announced immediately (`role="alert"`); other tones politely
 * (`role="status"`).
 */
export function Alert({
  tone = 'info',
  className,
  children,
}: {
  tone?: AlertTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2.5 rounded-md border px-3.5 py-3 text-sm',
        TONES[tone].box,
        className,
      )}
    >
      <Icon name={TONES[tone].icon} className="mt-px size-4" />
      <div className="min-w-0 text-foreground-secondary">{children}</div>
    </div>
  );
}
