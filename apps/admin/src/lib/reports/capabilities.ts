import { MAX_COMPLETION_PHOTOS } from '@smart-city/api';
import {
  canTransitionReportStatus,
  REPORT_STATUS_TRANSITIONS,
  type MunicipalStaffRole,
  type ReportStatus,
} from '@smart-city/shared';

import type { AccessRole } from '@/lib/auth/permissions';

/**
 * What the report screens OFFER each role. User experience only: every action is authorized
 * again by the server action (active membership, same municipality) and finally by the
 * database RPC, which is the authority. Each rule cites the SQL it mirrors so they stay in sync.
 */

const FINISHED: readonly ReportStatus[] = ['resolved', 'closed', 'rejected'];

export function isFinishedStatus(status: ReportStatus): boolean {
  return FINISHED.includes(status);
}

const isMunicipal = (role: AccessRole): role is MunicipalStaffRole => role !== 'platform_admin';

/**
 * The statuses this role may move the report to (update_report_status): the workflow edges,
 * dispatchers only to review/rejection, and `assigned` only once the report has a department
 * (routing itself happens through assignment).
 */
export function statusTargets(
  role: AccessRole,
  report: { status: ReportStatus; department_id: string | null },
): ReportStatus[] {
  if (!isMunicipal(role)) return [];
  return REPORT_STATUS_TRANSITIONS[report.status].filter(
    (to) =>
      canTransitionReportStatus(report.status, to, role) &&
      !(to === 'assigned' && report.department_id === null),
  );
}

/**
 * How this role may route / assign (assign_report):
 * - `full`: municipality admin — any department, any eligible assignee, return to intake.
 * - `department`: department manager — their own department's staff, or return to intake.
 * - `route`: intake dispatcher — choose a department only, never an individual.
 * - `none`: employees (and anyone else) only see the assignment.
 */
export type AssignmentMode = 'full' | 'department' | 'route' | 'none';

export function assignmentMode(role: AccessRole): AssignmentMode {
  switch (role) {
    case 'municipality_admin':
      return 'full';
    case 'department_manager':
      return 'department';
    case 'intake_dispatcher':
      return 'route';
    default:
      return 'none';
  }
}

/** Finished reports cannot be reassigned (assign_report). */
export function canEditAssignment(role: AccessRole, status: ReportStatus): boolean {
  return assignmentMode(role) !== 'none' && !isFinishedStatus(status);
}

/** Returning to intake is only possible before work starts (assign_report). */
export function canReturnToIntake(role: AccessRole, status: ReportStatus): boolean {
  const mode = assignmentMode(role);
  return (
    (mode === 'full' || mode === 'department' || mode === 'route') &&
    (['submitted', 'under_review', 'assigned'] as ReportStatus[]).includes(status)
  );
}

/** Reporter contact (get_report_reporter_contact → can_handle_report): never dispatchers. */
export function canViewReporterContact(role: AccessRole): boolean {
  return isMunicipal(role) && role !== 'intake_dispatcher';
}

/**
 * Completion photos (storage policy + add_report_attachment): handling staff (not dispatchers),
 * while the report is in progress or resolved, up to the limit.
 */
export function completionUpload(
  role: AccessRole,
  status: ReportStatus,
  existing: number,
): { allowed: boolean; reason?: 'role' | 'status' | 'limit'; remaining: number } {
  const remaining = Math.max(0, MAX_COMPLETION_PHOTOS - existing);
  if (!canViewReporterContact(role)) return { allowed: false, reason: 'role', remaining };
  if (status !== 'in_progress' && status !== 'resolved') {
    return { allowed: false, reason: 'status', remaining };
  }
  if (remaining === 0) return { allowed: false, reason: 'limit', remaining };
  return { allowed: true, remaining };
}

/** Statuses whose change deserves an explicit confirmation. */
export function needsConfirmation(status: ReportStatus): boolean {
  return status === 'resolved' || status === 'rejected' || status === 'closed';
}

/** The department select's value for "back to the intake queue". */
export const INTAKE_VALUE = 'intake';
