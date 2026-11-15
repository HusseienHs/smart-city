import {
  assignReportSchema,
  updateReportStatusSchema,
  type AssignReportInput,
  type UpdateReportStatusInput,
} from '@smart-city/shared';
import { z } from 'zod';

import type { SmartCityClient } from '../client';
import { ApiError } from '../errors/api-error';
import { runListQuery, runMaybeSingleQuery, runMutation } from '../utils/query';
import { requireUserId } from '../utils/session';
import { parseInput } from '../utils/validation';
import { STAFF_REPORT_LIST_COLUMNS } from './report-columns';
import type { StaffReportSummary } from './reports';

/*
 * Staff report workflow: status changes, routing / assignment / priority, comments and the
 * reporter's contact details. Every function is a thin, validated wrapper around the existing
 * SECURITY DEFINER RPC, called as the signed-in staff member. The RPCs are the authority: they
 * re-check the caller's role, the report's municipality and state, and every business rule.
 * Validation here only fails early with a clear reason.
 */

// ---------------------------------------------------------------------------------------------
// Current state
// ---------------------------------------------------------------------------------------------

const reportScopeSchema = z.strictObject({ municipalityId: z.uuid(), reportId: z.uuid() });

/**
 * The current list fields of one report in one municipality, or null when it doesn't exist, is
 * in another municipality or isn't visible to the caller (indistinguishable on purpose). Used
 * to confirm a report belongs to the active municipality before acting on it.
 */
export async function getStaffReportSummary(
  client: SmartCityClient,
  input: z.input<typeof reportScopeSchema>,
): Promise<StaffReportSummary | null> {
  const { municipalityId, reportId } = parseInput(reportScopeSchema, input);
  await requireUserId(client);
  const row = await runMaybeSingleQuery(
    client
      .from('reports')
      .select(STAFF_REPORT_LIST_COLUMNS)
      .eq('id', reportId)
      .eq('municipality_id', municipalityId)
      .maybeSingle(),
  );
  return (row as unknown as StaffReportSummary | null) ?? null;
}

// ---------------------------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------------------------

/**
 * Changes a report's status (`update_report_status`). Notes are internal unless `noteIsPublic`;
 * resolving and rejecting require a public note, and rejecting a reason (plus the original
 * report for duplicates). The database also enforces the workflow, the role limits and the
 * completion-photo rule.
 */
export async function updateReportStatus(
  client: SmartCityClient,
  input: z.input<typeof updateReportStatusSchema>,
): Promise<void> {
  const value: UpdateReportStatusInput = parseInput(updateReportStatusSchema, input);
  await requireUserId(client);
  const note = value.note ? value.note : undefined;
  await runMutation(
    client.rpc('update_report_status', {
      p_report_id: value.reportId,
      p_status: value.status,
      p_note: note,
      p_note_is_public: note ? value.noteIsPublic : false,
      p_rejection_reason: value.rejectionReason,
      p_duplicate_of_id: value.duplicateOfId,
    }),
  );
}

// ---------------------------------------------------------------------------------------------
// Assignment and priority
// ---------------------------------------------------------------------------------------------

/**
 * Routes, assigns or re-prioritizes a report (`assign_report`). `departmentId: null` returns it
 * to the intake queue; an assignee requires a department. Omitting `priority` keeps it.
 */
export async function assignReport(
  client: SmartCityClient,
  input: z.input<typeof assignReportSchema>,
): Promise<void> {
  const value: AssignReportInput = parseInput(assignReportSchema, input);
  await requireUserId(client);
  await runMutation(
    client.rpc('assign_report', {
      p_report_id: value.reportId,
      // The generated types mark the argument non-null; NULL is the documented "return to intake".
      p_department_id: value.departmentId as string,
      p_assignee_id: value.assigneeId ?? undefined,
      p_priority: value.priority,
    }),
  );
}

// ---------------------------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------------------------

export const REPORT_COMMENT_MAX_LENGTH = 2000;

const addStaffCommentSchema = z.strictObject({
  reportId: z.uuid(),
  body: z.string().trim().min(1).max(REPORT_COMMENT_MAX_LENGTH),
  /**
   * Required on purpose: the RPC's own default is a PUBLIC comment, which the citizen sees and
   * is notified about. Staff comments are internal unless the caller explicitly says otherwise.
   */
  isInternal: z.boolean(),
});
export type AddStaffCommentInput = z.input<typeof addStaffCommentSchema>;

/**
 * Adds a staff comment (`add_report_comment`). Internal comments are visible to staff only;
 * public ones are shown to the reporter, who is notified by the database.
 */
export async function addStaffReportComment(
  client: SmartCityClient,
  input: AddStaffCommentInput,
): Promise<string> {
  const { reportId, body, isInternal } = parseInput(addStaffCommentSchema, input);
  await requireUserId(client);
  const id = await runMaybeSingleQuery(
    client.rpc('add_report_comment', {
      p_report_id: reportId,
      p_body: body,
      p_is_internal: isInternal,
    }),
  );
  if (typeof id !== 'string') {
    throw new ApiError('server', { debug: { message: 'add_report_comment returned no id' } });
  }
  return id;
}

// ---------------------------------------------------------------------------------------------
// Reporter contact
// ---------------------------------------------------------------------------------------------

const reportIdSchema = z.strictObject({ reportId: z.uuid() });

export interface ReporterContact {
  /** Null when the reporter hasn't set a name. */
  fullName: string | null;
  /** Null when the reporter has no phone number. */
  phone: string | null;
}

/**
 * The reporter's name and phone (`get_report_reporter_contact`). Only staff handling the report
 * may call it (not intake dispatchers), and the database records every access in the audit log.
 * Returns null when the reporter's account no longer exists. Never cache the result.
 */
export async function getReporterContact(
  client: SmartCityClient,
  input: z.input<typeof reportIdSchema>,
): Promise<ReporterContact | null> {
  const { reportId } = parseInput(reportIdSchema, input);
  await requireUserId(client);
  const rows = await runListQuery(
    client.rpc('get_report_reporter_contact', { p_report_id: reportId }),
  );
  const [row] = rows;
  if (!row) return null;
  return {
    fullName: (row.full_name as string | null) || null,
    phone: (row.phone as string | null) || null,
  };
}

// ---------------------------------------------------------------------------------------------
// Municipality workflow settings
// ---------------------------------------------------------------------------------------------

export interface MunicipalityWorkflowSettings {
  /** Resolving a report requires at least one completion photo. */
  requireCompletionPhoto: boolean;
}

/** The workflow settings of a municipality the caller works in. */
export async function getMunicipalityWorkflowSettings(
  client: SmartCityClient,
  input: { municipalityId: string },
): Promise<MunicipalityWorkflowSettings> {
  const { municipalityId } = parseInput(z.strictObject({ municipalityId: z.uuid() }), input);
  await requireUserId(client);
  const row = (await runMaybeSingleQuery(
    client
      .from('municipalities')
      .select('require_completion_photo')
      .eq('id', municipalityId)
      .maybeSingle(),
  )) as { require_completion_photo?: boolean } | null;
  return { requireCompletionPhoto: row?.require_completion_photo === true };
}

// ---------------------------------------------------------------------------------------------
// Specific reasons for the UI
// ---------------------------------------------------------------------------------------------

/**
 * The exact messages raised by the workflow RPCs. ApiError keeps them in `debug` only; this list
 * turns them into reasons the UI can explain. A database test asserts the RPCs still raise these
 * exact texts (supabase/tests/staff-workflow-api.test.ts).
 */
export const STAFF_WORKFLOW_MESSAGES = {
  invalid_transition: ['Invalid status transition from'],
  dispatcher_status: ['Intake dispatchers can only move reports to review or reject them'],
  public_note_required: [
    'A public note for the citizen is required when a report is resolved or rejected',
  ],
  note_too_long: ['The note is too long'],
  rejection_reason_required: ['A rejection reason is required'],
  duplicate_invalid: [
    'A duplicate must reference the original report in the same municipality',
    'Only duplicates reference an original report',
  ],
  department_required: ['Route the report to a department first (assign_report)'],
  completion_photo_required: ['This municipality requires a completion photo before resolving'],
  employee_cannot_assign: ['Employees cannot assign reports'],
  dispatcher_department_only: [
    'Intake dispatchers route reports to departments; the department assigns an employee',
  ],
  manager_own_department: [
    'Department managers can only assign within their department or return the report to intake',
  ],
  finished_report: ['Finished reports cannot be reassigned'],
  in_progress_no_intake: ['Reports in progress cannot be returned to intake'],
  assignee_requires_department: ['An assignee requires a department'],
  department_unavailable: ['Department not found'],
  assignee_invalid: ['The assignee must be an active member of that department'],
  completion_photo_status: ['Completion photos require the report to be in progress or resolved'],
  completion_photo_limit: ['A report can have at most 5 completion photos'],
  photo_missing: ['The file has not been uploaded'],
  photo_invalid: [
    'The file is empty or larger than 10 MB',
    'Unsupported file type',
    'Invalid storage path',
  ],
} as const;

export type StaffWorkflowIssue = keyof typeof STAFF_WORKFLOW_MESSAGES;

/** A specific, explainable reason for a failed workflow action, or null. */
export function staffWorkflowIssue(error: unknown): StaffWorkflowIssue | null {
  if (!(error instanceof ApiError)) return null;
  if (error.code !== 'validation' && error.code !== 'forbidden') return null;
  const message = error.debug.message ?? '';
  for (const [issue, messages] of Object.entries(STAFF_WORKFLOW_MESSAGES)) {
    // Prefix match: some messages end with interpolated values ("… from assigned to closed").
    if ((messages as readonly string[]).some((text) => message.startsWith(text))) {
      return issue as StaffWorkflowIssue;
    }
  }
  return null;
}
