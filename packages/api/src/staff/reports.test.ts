import { describe, expect, it } from 'vitest';

import { ApiError } from '../errors/api-error';
import { callArgs, fakeClient, type FakeResponse } from '../test-support/fake-client';
import {
  STAFF_REPORT_ATTACHMENT_COLUMNS,
  STAFF_REPORT_COMMENT_COLUMNS,
  STAFF_REPORT_DETAIL_COLUMNS,
  STAFF_REPORT_HISTORY_COLUMNS,
  STAFF_REPORT_LIST_COLUMNS,
} from './report-columns';
import {
  getStaffReport,
  listColleagues,
  listStaffReports,
  STAFF_REPORT_MAX_PAGE_SIZE,
  toSearchPattern,
} from './reports';

const userId = '11111111-2222-4333-8444-555555555555';
const municipalityId = '7a2b3c4d-1e2f-4a5b-8c9d-0e1f2a3b4c5d';
const otherMunicipalityId = '9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f';
const reportId = '6f1f2b9e-6a8f-4d0e-9c8e-1d2a3b4c5d6e';
const departmentId = '8b3c4d5e-2f3a-4b5c-9d0e-1f2a3b4c5d6e';
const categoryId = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const neighborhoodId = '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e';
const employeeId = '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f';

const signedIn = (response: FakeResponse | Error | (FakeResponse | Error)[]) =>
  fakeClient(response, { userId });

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

const summary = (id: string) => ({
  id,
  municipality_id: municipalityId,
  tracking_number: 'TSA-2026-000001',
  status: 'submitted',
  priority: 'normal',
});

/** The recorded query calls, without the session check. */
const queryCalls = (calls: ReturnType<typeof fakeClient>['calls']) =>
  calls.filter((call) => call.method !== 'auth.getSession');

// ---------------------------------------------------------------------------------------------

describe('listStaffReports', () => {
  it('selects the explicit list columns with an exact count, scoped to the municipality', async () => {
    const { client, calls } = signedIn({ data: [summary(reportId)], count: 1 });
    const page = await listStaffReports(client, { municipalityId });

    expect(callArgs(calls, 'from')).toEqual([['reports']]);
    expect(callArgs(calls, 'select')).toEqual([
      [STAFF_REPORT_LIST_COLUMNS, { count: 'exact', head: false }],
    ]);
    expect(callArgs(calls, 'eq')[0]).toEqual(['municipality_id', municipalityId]);
    expect(page).toEqual({
      items: [summary(reportId)],
      total: 1,
      page: 1,
      pageSize: 25,
      pageCount: 1,
    });
  });

  it('defaults to newest first, with a stable tie-breaker and the first page', async () => {
    const { client, calls } = signedIn({ data: [], count: 0 });
    await listStaffReports(client, { municipalityId });
    expect(callArgs(calls, 'order')).toEqual([
      ['created_at', { ascending: false }],
      ['id', { ascending: false }],
    ]);
    expect(callArgs(calls, 'range')).toEqual([[0, 24]]);
  });

  it('applies every filter', async () => {
    const { client, calls } = signedIn({ data: [], count: 0 });
    await listStaffReports(client, {
      municipalityId,
      statuses: ['submitted', 'in_progress', 'submitted'],
      priorities: ['urgent'],
      departmentId,
      categoryId,
      neighborhoodId,
      unassigned: true,
      createdFrom: '2026-11-01T00:00:00+02:00',
      createdTo: '2026-11-30T23:59:59+02:00',
      sort: 'priority',
      direction: 'asc',
    });
    expect(callArgs(calls, 'in')).toEqual([
      ['status', ['submitted', 'in_progress']],
      ['priority', ['urgent']],
    ]);
    expect(callArgs(calls, 'eq')).toEqual([
      ['municipality_id', municipalityId],
      ['department_id', departmentId],
      ['category_id', categoryId],
      ['neighborhood_id', neighborhoodId],
    ]);
    expect(callArgs(calls, 'is')).toEqual([['assignee_id', null]]);
    expect(callArgs(calls, 'gte')).toEqual([['created_at', '2026-11-01T00:00:00+02:00']]);
    expect(callArgs(calls, 'lte')).toEqual([['created_at', '2026-11-30T23:59:59+02:00']]);
    expect(callArgs(calls, 'order')).toEqual([
      ['priority', { ascending: true }],
      ['id', { ascending: true }],
    ]);
  });

  it('empty status and priority lists mean "any"', async () => {
    const { client, calls } = signedIn({ data: [], count: 0 });
    await listStaffReports(client, { municipalityId, statuses: [], priorities: [] });
    expect(callArgs(calls, 'in')).toEqual([]);
  });

  it('assignedToMe filters by the caller’s own membership in that municipality', async () => {
    const membership = {
      employee_id: employeeId,
      municipality_id: municipalityId,
      municipality_code: 'TSA',
      municipality_name: { he: 'עיר' },
      municipality_status: 'active',
      role: 'employee',
      department_id: departmentId,
      department_name: { he: 'כבישים' },
      job_title: null,
    };
    const otherMembership = {
      ...membership,
      employee_id: reportId,
      municipality_id: otherMunicipalityId,
    };
    const { client, calls } = signedIn([
      { data: [otherMembership, membership] },
      { data: [], count: 0 },
    ]);
    await listStaffReports(client, { municipalityId, assignedToMe: true });
    expect(callArgs(calls, 'rpc')).toEqual([['get_my_staff_memberships']]);
    expect(callArgs(calls, 'eq')).toContainEqual(['assignee_id', employeeId]);
  });

  it('assignedToMe without a membership in that municipality returns nothing, without querying reports', async () => {
    const { client, calls } = signedIn({ data: [] });
    const page = await listStaffReports(client, { municipalityId, assignedToMe: true });
    expect(page).toEqual({ items: [], total: 0, page: 1, pageSize: 25, pageCount: 0 });
    expect(callArgs(calls, 'from')).toEqual([]);
  });

  describe('pagination', () => {
    it('requests exactly one page and reports the exact total', async () => {
      const { client, calls } = signedIn({ data: [summary(reportId)], count: 51 });
      const page = await listStaffReports(client, { municipalityId, page: 3, pageSize: 20 });
      expect(callArgs(calls, 'range')).toEqual([[40, 59]]);
      expect(page).toMatchObject({ total: 51, page: 3, pageSize: 20, pageCount: 3 });
    });

    it('a page past the end is an empty page with the real total (PGRST103)', async () => {
      const { client, calls } = signedIn([
        { error: { code: 'PGRST103', message: 'Requested range not satisfiable' }, status: 416 },
        { data: null, count: 12 },
      ]);
      const page = await listStaffReports(client, { municipalityId, page: 9, pageSize: 10 });
      expect(page).toEqual({ items: [], total: 12, page: 9, pageSize: 10, pageCount: 2 });
      // The count-only query carries the same tenant filter.
      expect(callArgs(calls, 'select')[1]).toEqual(['id', { count: 'exact', head: true }]);
      expect(callArgs(calls, 'eq')[1]).toEqual(['municipality_id', municipalityId]);
    });

    it('an empty result is not an error', async () => {
      const { client } = signedIn({ data: [], count: 0 });
      expect(await listStaffReports(client, { municipalityId })).toEqual({
        items: [],
        total: 0,
        page: 1,
        pageSize: 25,
        pageCount: 0,
      });
    });
  });

  describe('search', () => {
    it('a tracking number is matched exactly, case-insensitively', async () => {
      const { client, calls } = signedIn({ data: [], count: 0 });
      await listStaffReports(client, { municipalityId, search: '  tsa-2026-000042 ' });
      expect(callArgs(calls, 'eq')).toContainEqual(['tracking_number', 'TSA-2026-000042']);
      expect(callArgs(calls, 'or')).toEqual([]);
    });

    it('other text searches description and address, safely escaped', async () => {
      const { client, calls } = signedIn({ data: [], count: 0 });
      await listStaffReports(client, { municipalityId, search: 'broken pipe' });
      expect(callArgs(calls, 'or')).toEqual([
        ['description.ilike."%broken pipe%",address.ilike."%broken pipe%"'],
      ]);
    });

    it('escapes LIKE wildcards and PostgREST syntax', () => {
      expect(toSearchPattern('50%_off')).toBe('"%50\\\\%\\\\_off%"');
      expect(toSearchPattern('a,b.c:(d)')).toBe('"%a,b.c:(d)%"');
      expect(toSearchPattern('say "hi"')).toBe('"%say \\"hi\\"%"');
      expect(toSearchPattern('back\\slash')).toBe('"%back\\\\\\\\slash%"');
      // `*` is PostgREST's wildcard and can't be escaped: it is dropped.
      expect(toSearchPattern('a*b')).toBe('"%a b%"');
    });

    it('a blank search is ignored', async () => {
      const { client, calls } = signedIn({ data: [], count: 0 });
      await listStaffReports(client, { municipalityId, search: '   ' });
      expect(callArgs(calls, 'or')).toEqual([]);
    });
  });

  describe('validation (nothing is requested for invalid input)', () => {
    const invalid: [string, Record<string, unknown>][] = [
      ['missing municipality', {}],
      ['malformed municipality', { municipalityId: 'all' }],
      ['unknown status', { municipalityId, statuses: ['lost'] }],
      ['unknown priority', { municipalityId, priorities: ['asap'] }],
      ['unknown sort field', { municipalityId, sort: 'reporter_id' }],
      ['bad direction', { municipalityId, direction: 'sideways' }],
      ['page 0', { municipalityId, page: 0 }],
      ['fractional page', { municipalityId, page: 1.5 }],
      ['page size over the limit', { municipalityId, pageSize: STAFF_REPORT_MAX_PAGE_SIZE + 1 }],
      ['date without offset', { municipalityId, createdFrom: '2026-11-01 10:00' }],
      [
        'reversed date range',
        { municipalityId, createdFrom: '2026-12-01T00:00:00Z', createdTo: '2026-11-01T00:00:00Z' },
      ],
      ['assignedToMe with unassigned', { municipalityId, assignedToMe: true, unassigned: true }],
      ['search too long', { municipalityId, search: 'x'.repeat(101) }],
      ['unknown option', { municipalityId, reporterId: userId }],
    ];
    it.each(invalid)('%s', async (_name, input) => {
      const { client, calls } = signedIn({ data: [], count: 0 });
      const error = await failure(listStaffReports(client, input as never));
      expect(error.code).toBe('validation');
      expect(calls).toEqual([]);
    });
  });

  it('maps database errors', async () => {
    const { client } = signedIn({
      error: { code: '42501', message: 'permission denied' },
      status: 403,
    });
    expect((await failure(listStaffReports(client, { municipalityId }))).code).toBe('forbidden');
  });

  it('requires a signed-in user', async () => {
    const { client, calls } = fakeClient({ data: [] });
    expect((await failure(listStaffReports(client, { municipalityId }))).code).toBe('unauthorized');
    expect(queryCalls(calls)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------

const TEL_AVIV_WKB = '0101000020E61000003F90BC732860414068EC4B361E094040';

const detailRow = {
  ...summary(reportId),
  description: 'Deep pothole next to the bus stop',
  location: TEL_AVIV_WKB,
  location_accuracy_m: 8,
  rejection_reason: null,
  duplicate_of_id: null,
};
const attachment = {
  id: 'a1',
  report_id: reportId,
  municipality_id: municipalityId,
  kind: 'citizen_photo',
  storage_path: `${municipalityId}/${reportId}/citizen/p.jpg`,
  mime_type: 'image/jpeg',
  size_bytes: 1234,
  created_at: '2026-11-08T10:00:00Z',
};
const comment = {
  id: 'c1',
  report_id: reportId,
  municipality_id: municipalityId,
  author_employee_id: employeeId,
  from_reporter: false,
  body: 'Crew scheduled',
  is_internal: true,
  created_at: '2026-11-08T11:00:00Z',
};
const historyEntry = {
  id: 'h1',
  report_id: reportId,
  municipality_id: municipalityId,
  from_status: null,
  to_status: 'submitted',
  changed_by_employee_id: null,
  note: null,
  note_is_public: false,
  created_at: '2026-11-08T09:00:00Z',
};

describe('getStaffReport', () => {
  it('loads the report with explicit columns, scoped by id and municipality', async () => {
    const { client, calls } = signedIn([
      { data: detailRow },
      { data: [attachment] },
      { data: [comment] },
      { data: [historyEntry] },
    ]);
    const details = await getStaffReport(client, { municipalityId, reportId });

    expect(callArgs(calls, 'from')).toEqual([
      ['reports'],
      ['report_attachments'],
      ['report_comments'],
      ['report_status_history'],
    ]);
    expect(callArgs(calls, 'select')).toEqual([
      [STAFF_REPORT_DETAIL_COLUMNS],
      [STAFF_REPORT_ATTACHMENT_COLUMNS],
      [STAFF_REPORT_COMMENT_COLUMNS],
      [STAFF_REPORT_HISTORY_COLUMNS],
    ]);
    // Every query: this report, in this municipality.
    const eq = callArgs(calls, 'eq');
    expect(eq.slice(0, 2)).toEqual([
      ['id', reportId],
      ['municipality_id', municipalityId],
    ]);
    for (let i = 2; i < eq.length; i += 2) {
      expect(eq.slice(i, i + 2)).toEqual([
        ['report_id', reportId],
        ['municipality_id', municipalityId],
      ]);
    }

    expect(details).toEqual({
      report: {
        ...detailRow,
        location: { latitude: 32.0712345, longitude: 34.7512345 },
      },
      attachments: [attachment],
      comments: [comment],
      history: [historyEntry],
    });
  });

  it('children are ordered oldest first, with a stable tie-breaker', async () => {
    const { client, calls } = signedIn([
      { data: detailRow },
      { data: [] },
      { data: [] },
      { data: [] },
    ]);
    await getStaffReport(client, { municipalityId, reportId });
    expect(callArgs(calls, 'order')).toEqual([
      ['created_at'],
      ['id'],
      ['created_at'],
      ['id'],
      ['created_at'],
      ['id'],
    ]);
  });

  it('never exposes the raw location value', async () => {
    const { client } = signedIn([{ data: detailRow }, { data: [] }, { data: [] }, { data: [] }]);
    const details = await getStaffReport(client, { municipalityId, reportId });
    expect(JSON.stringify(details)).not.toContain(TEL_AVIV_WKB);
  });

  it('unknown, foreign-municipality and inaccessible reports are all simply null', async () => {
    // RLS hides the row in every one of these cases: the API can't — and doesn't — tell them apart.
    const { client, calls } = signedIn({ data: null });
    expect(await getStaffReport(client, { municipalityId, reportId })).toBeNull();
    expect(callArgs(calls, 'from')).toEqual([['reports']]);
  });

  it('a corrupted location is a server error, not a guess', async () => {
    const { client } = signedIn([
      { data: { ...detailRow, location: '0102000020E6100000' } },
      { data: [] },
      { data: [] },
      { data: [] },
    ]);
    expect((await failure(getStaffReport(client, { municipalityId, reportId }))).code).toBe(
      'server',
    );
  });

  it('validates ids before any request', async () => {
    const { client, calls } = signedIn({ data: null });
    for (const input of [
      { municipalityId, reportId: '1 or 1=1' },
      { municipalityId: 'x', reportId },
      { reportId },
    ]) {
      expect((await failure(getStaffReport(client, input as never))).code).toBe('validation');
    }
    expect(calls).toEqual([]);
  });

  it('requires a signed-in user', async () => {
    const { client } = fakeClient({ data: null });
    expect((await failure(getStaffReport(client, { municipalityId, reportId }))).code).toBe(
      'unauthorized',
    );
  });
});

// ---------------------------------------------------------------------------------------------

const colleagues = [
  {
    employee_id: 'e1',
    full_name: 'Dana',
    role: 'employee',
    department_id: departmentId,
    job_title: null,
  },
  {
    employee_id: 'e2',
    full_name: 'Omar',
    role: 'department_manager',
    department_id: departmentId,
    job_title: 'Head',
  },
  {
    employee_id: 'e3',
    full_name: null,
    role: 'employee',
    department_id: categoryId,
    job_title: null,
  },
  {
    employee_id: 'e4',
    full_name: 'Noa',
    role: 'intake_dispatcher',
    department_id: null,
    job_title: null,
  },
  {
    employee_id: 'e5',
    full_name: 'Avi',
    role: 'municipality_admin',
    department_id: null,
    job_title: null,
  },
];

describe('listColleagues', () => {
  it('uses the secure get_colleagues function for the given municipality', async () => {
    const { client, calls } = signedIn({ data: colleagues });
    const all = await listColleagues(client, { municipalityId });
    expect(callArgs(calls, 'rpc')).toEqual([
      ['get_colleagues', { p_municipality_id: municipalityId }],
    ]);
    expect(all.map((c) => c.employee_id)).toEqual(['e1', 'e2', 'e3', 'e4', 'e5']);
    expect(all[2]).toEqual({
      employee_id: 'e3',
      full_name: null,
      role: 'employee',
      department_id: categoryId,
      job_title: null,
    });
  });

  it('filters to one department and to assignable roles', async () => {
    const { client } = signedIn({ data: colleagues });
    const eligible = await listColleagues(client, {
      municipalityId,
      departmentId,
      assignableOnly: true,
    });
    expect(eligible.map((c) => c.employee_id)).toEqual(['e1', 'e2']);
  });

  it('assignable only: dispatchers and admins are never offered as assignees', async () => {
    const { client } = signedIn({ data: colleagues });
    const eligible = await listColleagues(client, { municipalityId, assignableOnly: true });
    expect(eligible.map((c) => c.role)).toEqual(['employee', 'department_manager', 'employee']);
  });

  it('callers who are not staff there get an empty list (database rule)', async () => {
    const { client } = signedIn({ data: [] });
    expect(await listColleagues(client, { municipalityId })).toEqual([]);
  });

  it('validates input and requires a session', async () => {
    const invalid = signedIn({ data: [] });
    expect((await failure(listColleagues(invalid.client, { municipalityId: 'x' }))).code).toBe(
      'validation',
    );
    expect(invalid.calls).toEqual([]);
    const signedOut = fakeClient({ data: [] });
    expect((await failure(listColleagues(signedOut.client, { municipalityId }))).code).toBe(
      'unauthorized',
    );
  });
});
