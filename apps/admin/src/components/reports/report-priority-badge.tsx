import type { ReportPriority } from '@smart-city/shared';

import type { BadgeTone } from '@/components/ui/badge';
import { cn } from '@/lib/cn';

/** One fixed tone per priority. The label is always shown; color is never the only signal. */
export const REPORT_PRIORITY_TONES: Readonly<Record<ReportPriority, BadgeTone>> = {
  low: 'neutral',
  normal: 'info',
  high: 'warning',
  urgent: 'danger',
};

const LEVEL: Readonly<Record<ReportPriority, number>> = { low: 1, normal: 2, high: 3, urgent: 4 };

const BAR_COLOR: Readonly<Record<ReportPriority, string>> = {
  low: 'bg-muted',
  normal: 'bg-info',
  high: 'bg-warning',
  urgent: 'bg-danger',
};

/** Four ascending signal bars, lit up to the priority's level. Decorative: pair with a label. */
export function PrioritySignal({
  priority,
  className,
}: {
  priority: ReportPriority;
  className?: string;
}) {
  return (
    <span aria-hidden className={cn('inline-flex h-3.5 items-end gap-[2px]', className)}>
      {[1, 2, 3, 4].map((bar) => (
        <span
          key={bar}
          className={cn(
            'w-[3px] rounded-[1px]',
            bar <= LEVEL[priority] ? BAR_COLOR[priority] : 'bg-border-strong',
          )}
          style={{ height: `${bar * 25}%` }}
        />
      ))}
    </span>
  );
}

/** A report's priority: signal bars and the label; urgent work is set in its tone. */
export function ReportPriorityBadge({
  priority,
  label,
}: {
  priority: ReportPriority;
  label: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-2 text-sm font-medium whitespace-nowrap',
        priority === 'urgent'
          ? 'text-danger'
          : priority === 'high'
            ? 'text-warning'
            : 'text-foreground-secondary',
      )}
    >
      <PrioritySignal priority={priority} />
      {label}
    </span>
  );
}
