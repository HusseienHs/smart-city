import { describe, expect, it } from 'vitest';

import { ApiError } from '../errors/api-error';
import { fromSupabaseError } from '../errors/to-api-error';
import { callArgs, fakeClient, type FakeResponse } from '../test-support/fake-client';
import { STAFF_REPORT_LIST_COLUMNS } from './report-columns';
import {
  addStaffReportComment,
  assignReport,
  getMunicipalityWorkflowSettings,
  getReporterContact,
  getStaffReportSummary,
  REPORT_COMMENT_MAX_LENGTH,
  staffWorkflowIssue,
  updateReportStatus,
} from './workflow';

const userId = '11111111-2222-4333-8444-555555555555';
const reportId = '6f1f2b9e-6a8f-4d0e-9c8e-1d2a3b4c5d6e';
const originalId = '7f1f2b9e-6a8f-4d0e-9c8e-1d2a3b4c5d6e';
const departmentId = '8b3c4d5e-2f3a-4b5c-9d0e-1f2a3b4c5d6e';
const employeeId = '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f';
const municipalityId = '7a2b3c4d-1e2f-4a5b-8c9d-0e1f2a3b4c5d';

const signedIn = (response: FakeResponse | FakeResponse[] = { data: null }) =>
  fakeClient(response, { userId });

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

const rpcError = (message: string, code = '22023'): FakeResponse => ({
  error: { code, message },
  status: 400,
});

describe('updateReportStatus', () => {
  it('calls update_report_status with an internal note by default', async () => {
    const { client, calls } = signedIn();
    await updateReportStatus(client, { reportId, status: 'in_progress', note: 'On it' });
    expect(callArgs(calls, 'rpc')).toEqual([
      [
        'update_report_status',
        {
          p_report_id: reportId,
          p_status: 'in_progress',
          p_note: 'On it',
          p_note_is_public: false,
          p_rejection_reason: undefined,
          p_duplicate_of_id: undefined,
        },
      ],
    ]);
  });

  it('never marks an empty note public', async () => {
    const { client, calls } = signedIn();
    await updateReportStatus(client, {
      reportId,
      status: 'under_review',
      note: '   ',
      noteIsPublic: true,
    });
    const [[, args]] = callArgs(calls, 'rpc') as [[string, Record<string, unknown>]];
    expect(args.p_note).toBeUndefined();
    expect(args.p_note_is_public).toBe(false);
  });

  it('sends rejection reason and the original report for duplicates', async () => {
    const { client, calls } = signedIn();
    await updateReportStatus(client, {
      reportId,
      status: 'rejected',
      note: 'Already reported',
      noteIsPublic: true,
      rejectionReason: 'duplicate',
      duplicateOfId: originalId,
    });
    const [[, args]] = callArgs(calls, 'rpc') as [[string, Record<string, unknown>]];
    expect(args).toMatchObject({
      p_status: 'rejected',
      p_note_is_public: true,
      p_rejection_reason: 'duplicate',
      p_duplicate_of_id: originalId,
    });
  });

  it('fails early, without a request, when a resolution has no public note', async () => {
    const { client, calls } = signedIn();
    const error = await failure(
      updateReportStatus(client, { reportId, status: 'resolved', note: 'Fixed it' }),
    );
    expect(error.code).toBe('validation');
    expect(callArgs(calls, 'rpc')).toEqual([]);
  });

  it('fails early for a rejection without a reason or a duplicate without the original', async () => {
    const { client, calls } = signedIn();
    await failure(
      updateReportStatus(client, {
        reportId,
        status: 'rejected',
        note: 'Not ours',
        noteIsPublic: true,
      }),
    );
    await failure(
      updateReportStatus(client, {
        reportId,
        status: 'rejected',
        note: 'Duplicate',
        noteIsPublic: true,
        rejectionReason: 'duplicate',
      }),
    );
    expect(callArgs(calls, 'rpc')).toEqual([]);
  });

  it('requires a session', async () => {
    const { client } = fakeClient({ data: null });
    const error = await failure(updateReportStatus(client, { reportId, status: 'under_review' }));
    expect(error.code).toBe('unauthorized');
  });

  it('surfaces database refusals as API errors with an explainable reason', async () => {
    const { client } = signedIn(
      rpcError('This municipality requires a completion photo before resolving'),
    );
    const error = await failure(
      updateReportStatus(client, {
        reportId,
        status: 'resolved',
        note: 'Fixed the pothole',
        noteIsPublic: true,
      }),
    );
    expect(error.code).toBe('validation');
    expect(staffWorkflowIssue(error)).toBe('completion_photo_required');
  });
});

describe('assignReport', () => {
  it('routes to a department with an assignee and priority', async () => {
    const { client, calls } = signedIn();
    await assignReport(client, {
      reportId,
      departmentId,
      assigneeId: employeeId,
      priority: 'high',
    });
    expect(callArgs(calls, 'rpc')).toEqual([
      [
        'assign_report',
        {
          p_report_id: reportId,
          p_department_id: departmentId,
          p_assignee_id: employeeId,
          p_priority: 'high',
        },
      ],
    ]);
  });

  it('returns a report to intake with an explicit null department', async () => {
    const { client, calls } = signedIn();
    await assignReport(client, { reportId, departmentId: null });
    const [[, args]] = callArgs(calls, 'rpc') as [[string, Record<string, unknown>]];
    expect(args.p_department_id).toBeNull();
    expect(args.p_assignee_id).toBeUndefined();
    expect(args.p_priority).toBeUndefined();
  });

  it('rejects an assignee without a department before calling the database', async () => {
    const { client, calls } = signedIn();
    const error = await failure(
      assignReport(client, { reportId, departmentId: null, assigneeId: employeeId }),
    );
    expect(error.code).toBe('validation');
    expect(callArgs(calls, 'rpc')).toEqual([]);
  });

  it('maps role refusals to explainable reasons', async () => {
    const { client } = signedIn(
      rpcError(
        'Intake dispatchers route reports to departments; the department assigns an employee',
        '42501',
      ),
    );
    const error = await failure(assignReport(client, { reportId, departmentId }));
    expect(error.code).toBe('forbidden');
    expect(staffWorkflowIssue(error)).toBe('dispatcher_department_only');
  });
});

describe('addStaffReportComment', () => {
  it('passes the visibility explicitly (the RPC defaults to public)', async () => {
    const { client, calls } = signedIn({ data: 'comment-id' });
    const id = await addStaffReportComment(client, {
      reportId,
      body: '  Checked on site  ',
      isInternal: true,
    });
    expect(id).toBe('comment-id');
    expect(callArgs(calls, 'rpc')).toEqual([
      [
        'add_report_comment',
        { p_report_id: reportId, p_body: 'Checked on site', p_is_internal: true },
      ],
    ]);
  });

  it('requires the visibility and a body of 1–2000 characters', async () => {
    const { client, calls } = signedIn({ data: 'comment-id' });
    await failure(addStaffReportComment(client, { reportId, body: 'x' } as never));
    await failure(addStaffReportComment(client, { reportId, body: '   ', isInternal: true }));
    await failure(
      addStaffReportComment(client, {
        reportId,
        body: 'x'.repeat(REPORT_COMMENT_MAX_LENGTH + 1),
        isInternal: false,
      }),
    );
    expect(callArgs(calls, 'rpc')).toEqual([]);
    await addStaffReportComment(client, {
      reportId,
      body: 'x'.repeat(REPORT_COMMENT_MAX_LENGTH),
      isInternal: false,
    });
    expect(callArgs(calls, 'rpc')).toHaveLength(1);
  });
});

describe('getReporterContact', () => {
  it('returns the name and phone from the audited RPC', async () => {
    const { client, calls } = signedIn({ data: [{ full_name: 'Dana', phone: '+972501234567' }] });
    expect(await getReporterContact(client, { reportId })).toEqual({
      fullName: 'Dana',
      phone: '+972501234567',
    });
    expect(callArgs(calls, 'rpc')).toEqual([
      ['get_report_reporter_contact', { p_report_id: reportId }],
    ]);
  });

  it('returns null when the reporter no longer exists, and nulls for missing fields', async () => {
    expect(await getReporterContact(signedIn({ data: [] }).client, { reportId })).toBeNull();
    expect(
      await getReporterContact(signedIn({ data: [{ full_name: '', phone: null }] }).client, {
        reportId,
      }),
    ).toEqual({ fullName: null, phone: null });
  });

  it('reports a refusal (dispatchers, other departments) as forbidden', async () => {
    const { client } = signedIn(rpcError('Report not found or access denied', '42501'));
    const error = await failure(getReporterContact(client, { reportId }));
    expect(error.code).toBe('forbidden');
    expect(staffWorkflowIssue(error)).toBeNull();
  });
});

describe('getMunicipalityWorkflowSettings', () => {
  it('reads the completion-photo requirement of the municipality', async () => {
    const { client, calls } = signedIn({ data: { require_completion_photo: true } });
    expect(await getMunicipalityWorkflowSettings(client, { municipalityId })).toEqual({
      requireCompletionPhoto: true,
    });
    expect(callArgs(calls, 'select')).toEqual([['require_completion_photo']]);
    expect(callArgs(calls, 'eq')).toEqual([['id', municipalityId]]);
  });

  it('defaults to not required when the row is not visible', async () => {
    const { client } = signedIn({ data: null });
    expect(await getMunicipalityWorkflowSettings(client, { municipalityId })).toEqual({
      requireCompletionPhoto: false,
    });
  });
});

describe('staffWorkflowIssue', () => {
  it('matches messages with interpolated values by prefix', () => {
    const error = fromSupabaseError(
      { code: '22023', message: 'Invalid status transition from assigned to closed' },
      400,
    );
    expect(staffWorkflowIssue(error)).toBe('invalid_transition');
  });

  it('ignores unrelated errors and non-API errors', () => {
    expect(staffWorkflowIssue(new Error('Department not found'))).toBeNull();
    expect(staffWorkflowIssue(new ApiError('network'))).toBeNull();
    expect(
      staffWorkflowIssue(fromSupabaseError({ code: 'XX000', message: 'Department not found' })),
    ).toBeNull();
  });
});

describe('getStaffReportSummary', () => {
  it('reads the list columns of one report, scoped to the municipality', async () => {
    const { client, calls } = signedIn({ data: { id: reportId, status: 'assigned' } });
    expect(await getStaffReportSummary(client, { municipalityId, reportId })).toEqual({
      id: reportId,
      status: 'assigned',
    });
    expect(callArgs(calls, 'select')).toEqual([[STAFF_REPORT_LIST_COLUMNS]]);
    expect(callArgs(calls, 'eq')).toEqual([
      ['id', reportId],
      ['municipality_id', municipalityId],
    ]);
  });

  it('returns null for reports that are missing, foreign or not visible', async () => {
    const { client } = signedIn({ data: null });
    expect(await getStaffReportSummary(client, { municipalityId, reportId })).toBeNull();
  });
});
