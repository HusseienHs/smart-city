'use server';

import {
  addStaffReportComment,
  assignReport,
  getReporterContact,
  getStaffReportSummary,
  isApiError,
  listStaffReports,
  registerCompletionPhoto,
  staffWorkflowIssue,
  toApiError,
  updateReportStatus,
  REPORT_COMMENT_MAX_LENGTH,
  type ApiError,
  type ReporterContact,
  type SmartCityClient,
  type StaffReportSummary,
} from '@smart-city/api';
import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  isValidTrackingNumber,
  normalizeTrackingNumber,
  REPORT_PRIORITIES,
  REPORT_REJECTION_REASONS,
  REPORT_STATUSES,
  type Locale,
  type ReportPriority,
  type ReportRejectionReason,
  type ReportStatus,
} from '@smart-city/shared';
import { createTranslator, type Translator } from '@smart-city/shared/i18n';
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';

import { getStaffAccess } from '@/lib/auth/staff-context';
import { localizedHref } from '@/lib/i18n/routing';
import { INTAKE_VALUE } from '@/lib/reports/capabilities';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/*
 * Server Actions for the report workflow. Each one authorizes itself, on every call:
 *
 * 1. the session is verified (getClaims) and the caller must be active staff with an ACTIVE
 *    municipality — read from the database, never from the form;
 * 2. the report must be visible to the caller IN THAT municipality (a report id from another
 *    municipality, or one the caller can't see, is refused the same way);
 * 3. the database RPC then applies the real rules (role, department, status, limits) as the
 *    caller's own session — no privileged key is ever used.
 *
 * Results carry localized messages only; database details stay in server logs.
 */

export interface ReportActionState {
  status: 'idle' | 'success' | 'error';
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Changes on every result, so the form can react to repeated identical results. */
  key?: number;
  /**
   * What was typed, echoed back on failure: React resets uncontrolled fields after a form
   * action, so the forms use these as default values.
   */
  values?: Record<string, string>;
}

export interface ContactActionState extends ReportActionState {
  contact?: ReporterContact | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readLocale(formData: FormData): Locale {
  const value = formData.get('locale');
  return isSupportedLocale(value) ? value : DEFAULT_LOCALE;
}

function readText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

const asApiError = (error: unknown): ApiError => (isApiError(error) ? error : toApiError(error));

function errorState(t: Translator, error: unknown): ReportActionState {
  const apiError = asApiError(error);
  if (apiError.code === 'server' || apiError.code === 'network') {
    // Details for operators only; never returned to the browser.
    console.error('[reports] action failed', apiError.code, apiError.debug);
  }
  const issue = staffWorkflowIssue(apiError);
  return {
    status: 'error',
    message: issue ? t(`adminReports.issues.${issue}`) : t(apiError.messageKey),
    key: Date.now(),
  };
}

const fail = (message: string, fieldErrors?: Record<string, string>): ReportActionState => ({
  status: 'error',
  message,
  fieldErrors,
  key: Date.now(),
});

const succeed = (message: string): ReportActionState => ({
  status: 'success',
  message,
  key: Date.now(),
});

interface Acting {
  client: SmartCityClient;
  municipalityId: string;
  report: StaffReportSummary;
}

/**
 * Steps 1 and 2 above: the caller's active municipality (from the database) and the report as
 * the caller sees it there. Returns a localized error state instead when either is missing.
 */
async function acting(t: Translator, reportId: string): Promise<Acting | ReportActionState> {
  const access = await getStaffAccess();
  if (access.status !== 'staff') return fail(t('apiErrors.unauthorized'));
  if (!access.active) return fail(t('apiErrors.forbidden'));
  if (!UUID.test(reportId)) return fail(t('apiErrors.forbidden'));
  const client = await createSupabaseServerClient();
  const municipalityId = access.active.municipality_id;
  const report = await getStaffReportSummary(client, { municipalityId, reportId });
  if (!report) return fail(t('apiErrors.forbidden'));
  return { client, municipalityId, report };
}

const isActing = (value: Acting | ReportActionState): value is Acting => 'client' in value;

// ---------------------------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------------------------

export async function changeReportStatusAction(
  previous: ReportActionState,
  formData: FormData,
): Promise<ReportActionState> {
  const result = await changeReportStatus(previous, formData);
  return result.status === 'error'
    ? {
        ...result,
        values: {
          note: readText(formData, 'note'),
          duplicateOf: readText(formData, 'duplicateOf'),
        },
      }
    : result;
}

async function changeReportStatus(
  _previous: ReportActionState,
  formData: FormData,
): Promise<ReportActionState> {
  const t = createTranslator(readLocale(formData));
  const reportId = readText(formData, 'reportId');
  const status = readText(formData, 'status') as ReportStatus;
  const note = readText(formData, 'note').trim();
  const rejectionReason = readText(formData, 'rejectionReason') as ReportRejectionReason | '';
  const duplicateTracking = normalizeTrackingNumber(readText(formData, 'duplicateOf'));

  if (!(REPORT_STATUSES as readonly string[]).includes(status)) {
    return fail(t('adminReports.status.choose'), { status: t('adminReports.status.choose') });
  }
  // Resolving and rejecting always send a public note; other notes are public only when asked.
  const requiresPublicNote = status === 'resolved' || status === 'rejected';
  const noteIsPublic = requiresPublicNote || formData.get('notePublic') === 'on';

  const fieldErrors: Record<string, string> = {};
  if (requiresPublicNote && note.length < 5) {
    fieldErrors.note = t('adminReports.status.publicNoteRequired');
  }
  if (note.length > REPORT_COMMENT_MAX_LENGTH)
    fieldErrors.note = t('adminReports.issues.note_too_long');
  if (status === 'rejected') {
    if (!(REPORT_REJECTION_REASONS as readonly string[]).includes(rejectionReason)) {
      fieldErrors.rejectionReason = t('adminReports.status.reasonRequired');
    } else if (rejectionReason === 'duplicate' && !isValidTrackingNumber(duplicateTracking)) {
      fieldErrors.duplicateOf = t('adminReports.status.duplicateRequired');
    }
  }
  if (Object.keys(fieldErrors).length > 0) {
    return fail(Object.values(fieldErrors)[0]!, fieldErrors);
  }

  try {
    const current = await acting(t, reportId);
    if (!isActing(current)) return current;

    let duplicateOfId: string | undefined;
    if (status === 'rejected' && rejectionReason === 'duplicate') {
      // Resolved within the active municipality, as the caller sees it.
      const { items } = await listStaffReports(current.client, {
        municipalityId: current.municipalityId,
        search: duplicateTracking,
        pageSize: 1,
      });
      const original = items.find((item) => item.tracking_number === duplicateTracking);
      if (!original) {
        const message = t('adminReports.status.duplicateNotFound');
        return fail(message, { duplicateOf: message });
      }
      if (original.id === current.report.id) {
        const message = t('adminReports.status.duplicateSelf');
        return fail(message, { duplicateOf: message });
      }
      duplicateOfId = original.id;
    }

    await updateReportStatus(current.client, {
      reportId: current.report.id,
      status,
      note: note || undefined,
      noteIsPublic,
      rejectionReason:
        status === 'rejected' ? (rejectionReason as ReportRejectionReason) : undefined,
      duplicateOfId,
    });
  } catch (error) {
    return errorState(t, error);
  }
  refresh();
  return succeed(t('adminReports.status.updated', { status: t(`reportStatus.${status}`) }));
}

// ---------------------------------------------------------------------------------------------
// Assignment and priority
// ---------------------------------------------------------------------------------------------

export async function assignReportAction(
  _previous: ReportActionState,
  formData: FormData,
): Promise<ReportActionState> {
  const locale = readLocale(formData);
  const t = createTranslator(locale);
  const reportId = readText(formData, 'reportId');
  const departmentValue = readText(formData, 'departmentId');
  const assigneeValue = readText(formData, 'assigneeId');
  const priorityValue = readText(formData, 'priority');

  const departmentId = departmentValue === INTAKE_VALUE ? null : departmentValue;
  if (departmentId !== null && !UUID.test(departmentId)) {
    return fail(t('adminReports.issues.department_unavailable'));
  }
  const assigneeId = assigneeValue ? assigneeValue : null;
  if (assigneeId !== null && !UUID.test(assigneeId)) {
    return fail(t('adminReports.issues.assignee_invalid'));
  }
  if (assigneeId && departmentId === null) {
    return fail(t('adminReports.issues.assignee_requires_department'));
  }
  const priority = (REPORT_PRIORITIES as readonly string[]).includes(priorityValue)
    ? (priorityValue as ReportPriority)
    : undefined;

  let stillVisible = true;
  try {
    const current = await acting(t, reportId);
    if (!isActing(current)) return current;
    await assignReport(current.client, {
      reportId: current.report.id,
      departmentId,
      assigneeId,
      priority,
    });
    // A manager returning a report to intake, for example, no longer sees it.
    stillVisible =
      (await getStaffReportSummary(current.client, {
        municipalityId: current.municipalityId,
        reportId: current.report.id,
      }).catch(() => current.report)) !== null;
  } catch (error) {
    return errorState(t, error);
  }
  if (!stillVisible) redirect(localizedHref(locale, '/reports'));
  refresh();
  return succeed(t('adminReports.assignment.saved'));
}

// ---------------------------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------------------------

export async function addReportCommentAction(
  previous: ReportActionState,
  formData: FormData,
): Promise<ReportActionState> {
  const result = await addReportComment(previous, formData);
  return result.status === 'error'
    ? { ...result, values: { body: readText(formData, 'body') } }
    : result;
}

async function addReportComment(
  _previous: ReportActionState,
  formData: FormData,
): Promise<ReportActionState> {
  const t = createTranslator(readLocale(formData));
  const reportId = readText(formData, 'reportId');
  const body = readText(formData, 'body').trim();
  // Internal unless the form explicitly says "public".
  const isInternal = readText(formData, 'visibility') !== 'public';

  if (body.length === 0) {
    const message = t('adminReports.comments.required');
    return fail(message, { body: message });
  }
  if (body.length > REPORT_COMMENT_MAX_LENGTH) {
    const message = t('adminReports.comments.tooLong', { max: REPORT_COMMENT_MAX_LENGTH });
    return fail(message, { body: message });
  }

  try {
    const current = await acting(t, reportId);
    if (!isActing(current)) return current;
    await addStaffReportComment(current.client, { reportId: current.report.id, body, isInternal });
  } catch (error) {
    return errorState(t, error);
  }
  refresh();
  return succeed(t('adminReports.comments.posted'));
}

// ---------------------------------------------------------------------------------------------
// Reporter contact
// ---------------------------------------------------------------------------------------------

/**
 * Loads the reporter's contact details on explicit request. The database audits every call and
 * refuses anyone not handling the report (including intake dispatchers). The result goes only
 * to this response: it is never cached or stored.
 */
export async function revealReporterContactAction(
  _previous: ContactActionState,
  formData: FormData,
): Promise<ContactActionState> {
  const t = createTranslator(readLocale(formData));
  const reportId = readText(formData, 'reportId');
  try {
    const current = await acting(t, reportId);
    if (!isActing(current)) return current;
    const contact = await getReporterContact(current.client, { reportId: current.report.id });
    return { status: 'success', contact, key: Date.now() };
  } catch (error) {
    const state = errorState(t, error);
    if (asApiError(error).code === 'forbidden') {
      return { ...state, message: t('adminReports.contact.forbidden') };
    }
    return state;
  }
}

// ---------------------------------------------------------------------------------------------
// Completion photos
// ---------------------------------------------------------------------------------------------

export interface RegisterPhotoResult {
  ok: boolean;
  message?: string;
}

/**
 * Registers a completion photo the browser has already uploaded to storage (the bytes never
 * pass through this server). The database checks the caller, the report's status, the limit,
 * the path and the stored file's real size and type.
 */
export async function registerCompletionPhotoAction(input: {
  locale: string;
  reportId: string;
  storagePath: string;
}): Promise<RegisterPhotoResult> {
  const locale = isSupportedLocale(input.locale) ? input.locale : DEFAULT_LOCALE;
  const t = createTranslator(locale);
  try {
    const current = await acting(t, String(input.reportId));
    if (!isActing(current)) return { ok: false, message: current.message };
    const expectedPrefix = `${current.municipalityId}/${current.report.id}/completion/`;
    if (typeof input.storagePath !== 'string' || !input.storagePath.startsWith(expectedPrefix)) {
      return { ok: false, message: t('adminReports.issues.photo_invalid') };
    }
    await registerCompletionPhoto(current.client, {
      reportId: current.report.id,
      storagePath: input.storagePath,
    });
  } catch (error) {
    const apiError = asApiError(error);
    // A retry after a successful registration: the path is unique, so it is already recorded.
    if (apiError.code !== 'conflict') return { ok: false, message: errorState(t, error).message };
  }
  refresh();
  return { ok: true };
}
