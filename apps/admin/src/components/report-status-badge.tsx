import type { ReportStatus } from '@smart-city/shared';

import { Badge, type BadgeTone } from '@/components/ui/badge';

/** One fixed tone per report status, used everywhere a status is shown. */
export const REPORT_STATUS_TONES: Readonly<Record<ReportStatus, BadgeTone>> = {
  submitted: 'info',
  under_review: 'warning',
  assigned: 'violet',
  in_progress: 'primary',
  resolved: 'success',
  closed: 'neutral',
  rejected: 'danger',
};

export function ReportStatusBadge({ status, label }: { status: ReportStatus; label: string }) {
  return (
    <Badge tone={REPORT_STATUS_TONES[status]} dot>
      {label}
    </Badge>
  );
}
