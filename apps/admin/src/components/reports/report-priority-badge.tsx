import type { ReportPriority } from '@smart-city/shared';

import { Badge, type BadgeTone } from '@/components/ui/badge';

/** One fixed tone per priority. The label is always shown; color is never the only signal. */
export const REPORT_PRIORITY_TONES: Readonly<Record<ReportPriority, BadgeTone>> = {
  low: 'neutral',
  normal: 'info',
  high: 'warning',
  urgent: 'danger',
};

export function ReportPriorityBadge({
  priority,
  label,
}: {
  priority: ReportPriority;
  label: string;
}) {
  return (
    <Badge
      tone={REPORT_PRIORITY_TONES[priority]}
      dot={priority === 'high' || priority === 'urgent'}
    >
      {label}
    </Badge>
  );
}
