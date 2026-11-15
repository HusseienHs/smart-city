import { describe, expect, it, vi } from 'vitest';

import type { SmartCityClient } from '../client';
import { signUpStaff } from '../auth/staff-sign-up';
import { ApiError } from '../errors/api-error';
import { fromSupabaseError } from '../errors/to-api-error';
import { callArgs, fakeClient, type FakeResponse } from '../test-support/fake-client';
import {
  countOpenReportsAssignedTo,
  createDepartment,
  getDepartmentReportCounts,
  listManagedDepartments,
  MANAGED_DEPARTMENT_COLUMNS,
  setDepartmentActive,
  updateDepartment,
} from './departments';
import {
  createStaffInvitation,
  invitationState,
  listMunicipalityStaff,
  listStaffInvitations,
  revokeStaffInvitation,
  setEmployeeActive,
  setEmployeeRole,
  STAFF_INVITATION_COLUMNS,
  staffAdminIssue,
  updateEmployeeJobTitle,
} from './staff-admin';

const userId = '11111111-2222-4333-8444-555555555555';
const muni = '7a2b3c4d-1e2f-4a5b-8c9d-0e1f2a3b4c5d';
const dept = '8b3c4d5e-2f3a-4b5c-9d0e-1f2a3b4c5d6e';
const dept2 = '9b3c4d5e-2f3a-4b5c-9d0e-1f2a3b4c5d6e';
const emp = '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f';
const emp2 = '4c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f';
const inv = '5c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f';

const signedIn = (response: FakeResponse | FakeResponse[] = { data: null }) =>
  fakeClient(response, { userId });

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

const deptRow = {
  id: dept,
  municipality_id: muni,
  name: { he: 'כבישים', en: 'Roads' },
  is_active: true,
  email: null,
  phone: null,
};

describe('departments', () => {
  it('lists every department of the municipality with explicit columns', async () => {
    const { client, calls } = signedIn({ data: [deptRow] });
    expect(await listManagedDepartments(client, { municipalityId: muni })).toEqual([
      { id: dept, name: { he: 'כבישים', en: 'Roads' }, isActive: true, email: null, phone: null },
    ]);
    expect(callArgs(calls, 'select')).toEqual([[MANAGED_DEPARTMENT_COLUMNS]]);
    expect(callArgs(calls, 'eq')).toEqual([['municipality_id', muni]]);
  });

  it('creates a department with only the given languages', async () => {
    const { client, calls } = signedIn({ data: deptRow });
    await createDepartment(client, {
      municipalityId: muni,
      department: {
        name: { he: ' כבישים ', ar: '', en: 'Roads' },
        email: 'roads@city.il',
        phone: '',
      },
    });
    expect(callArgs(calls, 'insert')).toEqual([
      [
        {
          municipality_id: muni,
          name: { he: 'כבישים', en: 'Roads' },
          email: 'roads@city.il',
          phone: null,
          is_active: true,
        },
      ],
    ]);
  });

  it('rejects invalid department input without a request', async () => {
    const { client, calls } = signedIn();
    await failure(
      createDepartment(client, { municipalityId: muni, department: { name: { he: '' } } }),
    );
    await failure(
      createDepartment(client, {
        municipalityId: muni,
        department: { name: { he: 'א' }, email: 'x' },
      }),
    );
    expect(callArgs(calls, 'insert')).toEqual([]);
  });

  it('scopes updates to the municipality and treats a filtered-out row as forbidden', async () => {
    const { client, calls } = signedIn({ data: null });
    const error = await failure(
      updateDepartment(client, {
        municipalityId: muni,
        departmentId: dept,
        department: { name: { he: 'א' } },
      }),
    );
    expect(error.code).toBe('forbidden');
    expect(callArgs(calls, 'eq')).toEqual([
      ['id', dept],
      ['municipality_id', muni],
    ]);
    expect(callArgs(calls, 'update')).toEqual([[{ name: { he: 'א' }, email: null, phone: null }]]);
  });

  it('activates and deactivates', async () => {
    const { client, calls } = signedIn({ data: { id: dept } });
    await setDepartmentActive(client, {
      municipalityId: muni,
      departmentId: dept,
      isActive: false,
    });
    expect(callArgs(calls, 'update')).toEqual([[{ is_active: false }]]);
  });

  it('counts open reports per department with head-only exact counts', async () => {
    const { client, calls } = signedIn([{ count: 3 }, { count: 0 }]);
    expect(
      await getDepartmentReportCounts(client, {
        municipalityId: muni,
        departmentIds: [dept, dept2, dept],
      }),
    ).toEqual({ [dept]: 3, [dept2]: 0 });
    expect(callArgs(calls, 'select')).toEqual([
      ['id', { count: 'exact', head: true }],
      ['id', { count: 'exact', head: true }],
    ]);
    expect(callArgs(calls, 'in')[0]).toEqual([
      'status',
      ['submitted', 'under_review', 'assigned', 'in_progress'],
    ]);
  });

  it('counts open reports assigned to an employee', async () => {
    const { client, calls } = signedIn({ count: 2 });
    expect(
      await countOpenReportsAssignedTo(client, { municipalityId: muni, employeeId: emp }),
    ).toBe(2);
    expect(callArgs(calls, 'eq')).toEqual([
      ['municipality_id', muni],
      ['assignee_id', emp],
    ]);
  });
});

describe('staff directory', () => {
  it('reads names through get_municipality_staff only, without user ids', async () => {
    const { client, calls } = signedIn({
      data: [
        {
          employee_id: emp,
          full_name: '',
          role: 'employee',
          department_id: dept,
          job_title: null,
          is_active: false,
          created_at: 'c',
          updated_at: 'u',
        },
      ],
    });
    const staff = await listMunicipalityStaff(client, { municipalityId: muni });
    expect(callArgs(calls, 'rpc')).toEqual([
      ['get_municipality_staff', { p_municipality_id: muni }],
    ]);
    expect(staff).toEqual([
      {
        employee_id: emp,
        full_name: null,
        role: 'employee',
        department_id: dept,
        job_title: null,
        is_active: false,
        created_at: 'c',
        updated_at: 'u',
      },
    ]);
  });
});

describe('invitations', () => {
  const row = (status: string, expires_at: string) => ({
    id: inv,
    municipality_id: muni,
    email: 'dana@city.il',
    role: 'employee',
    department_id: dept,
    job_title: null,
    status,
    expires_at,
    responded_at: null,
    created_at: '2026-11-01T00:00:00Z',
  });

  it('never selects user-id columns and derives the expired state', async () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const past = new Date(Date.now() - 1000).toISOString();
    const { client, calls } = signedIn({
      data: [row('pending', future), row('pending', past), row('revoked', past)],
    });
    const invitations = await listStaffInvitations(client, { municipalityId: muni });
    expect(STAFF_INVITATION_COLUMNS).not.toMatch(/invited_by|accepted_user_id/);
    expect(callArgs(calls, 'select')).toEqual([[STAFF_INVITATION_COLUMNS]]);
    expect(invitations.map((i) => i.state)).toEqual(['pending', 'expired', 'revoked']);
  });

  it('computes the state at a given time', () => {
    const at = new Date('2026-11-08T12:00:00Z');
    expect(invitationState({ status: 'pending', expires_at: '2026-11-08T12:00:00Z' }, at)).toBe(
      'expired',
    );
    expect(invitationState({ status: 'pending', expires_at: '2026-11-09T00:00:00Z' }, at)).toBe(
      'pending',
    );
    expect(invitationState({ status: 'accepted', expires_at: '2026-01-01T00:00:00Z' }, at)).toBe(
      'accepted',
    );
  });

  it('inserts only the granted columns, with a normalized email', async () => {
    const { client, calls } = signedIn({ data: row('pending', '2026-12-01T00:00:00Z') });
    await createStaffInvitation(client, {
      municipalityId: muni,
      invitation: {
        email: ' Dana@City.IL ',
        role: 'employee',
        departmentId: dept,
        jobTitle: ' Inspector ',
      },
    });
    expect(callArgs(calls, 'insert')).toEqual([
      [
        {
          municipality_id: muni,
          email: 'dana@city.il',
          role: 'employee',
          department_id: dept,
          job_title: 'Inspector',
        },
      ],
    ]);
  });

  it('reports a duplicate pending invitation as a specific issue', async () => {
    const { client } = signedIn({
      error: {
        code: '23505',
        message:
          'duplicate key value violates unique constraint "staff_invitations_one_pending_idx"',
      },
      status: 409,
    });
    const error = await failure(
      createStaffInvitation(client, {
        municipalityId: muni,
        invitation: { email: 'a@b.il', role: 'municipality_admin', departmentId: null },
      }),
    );
    expect(staffAdminIssue(error)).toBe('invitation_pending');
  });

  it('revokes through the RPC', async () => {
    const { client, calls } = signedIn();
    await revokeStaffInvitation(client, { invitationId: inv });
    expect(callArgs(calls, 'rpc')).toEqual([['revoke_staff_invitation', { p_invitation_id: inv }]]);
  });
});

describe('memberships', () => {
  it('changes role and department through set_employee_role and returns the reports moved', async () => {
    const { client, calls } = signedIn({ data: 4 });
    expect(
      await setEmployeeRole(client, {
        employeeId: emp,
        role: 'employee',
        departmentId: dept2,
        reassignTo: emp2,
      }),
    ).toBe(4);
    expect(callArgs(calls, 'rpc')).toEqual([
      [
        'set_employee_role',
        { p_employee_id: emp, p_role: 'employee', p_department_id: dept2, p_reassign_to: emp2 },
      ],
    ]);
  });

  it('sends a null department for roles without one, and validates combinations first', async () => {
    const { client, calls } = signedIn({ data: 0 });
    await setEmployeeRole(client, {
      employeeId: emp,
      role: 'intake_dispatcher',
      departmentId: null,
    });
    expect((callArgs(calls, 'rpc')[0]![1] as Record<string, unknown>).p_department_id).toBeNull();
    await failure(
      setEmployeeRole(client, { employeeId: emp, role: 'employee', departmentId: null }),
    );
    expect(callArgs(calls, 'rpc')).toHaveLength(1);
  });

  it('updates only job_title and is_active, scoped to the municipality', async () => {
    const { client, calls } = signedIn({ data: { id: emp } });
    await updateEmployeeJobTitle(client, { municipalityId: muni, employeeId: emp, jobTitle: '' });
    await setEmployeeActive(client, { municipalityId: muni, employeeId: emp, isActive: false });
    expect(callArgs(calls, 'update')).toEqual([[{ job_title: null }], [{ is_active: false }]]);
    expect(callArgs(calls, 'eq')).toEqual([
      ['id', emp],
      ['municipality_id', muni],
      ['id', emp],
      ['municipality_id', muni],
    ]);
  });

  it('maps database refusals to explainable reasons', () => {
    const error = (message: string, code = '42501') => fromSupabaseError({ code, message }, 403);
    expect(staffAdminIssue(error('A municipality must keep at least one active admin'))).toBe(
      'last_admin',
    );
    expect(staffAdminIssue(error('You cannot change your own status'))).toBe('self_change');
    expect(staffAdminIssue(error('This role requires a department', '22023'))).toBe(
      'department_required',
    );
    expect(staffAdminIssue(error('Employee not found or access denied'))).toBeNull();
    expect(staffAdminIssue(new Error('x'))).toBeNull();
  });
});

describe('signUpStaff', () => {
  const auth = { signUp: vi.fn().mockResolvedValue({ data: { session: null }, error: null }) };
  const client = { auth } as unknown as SmartCityClient;

  it('sends name and language only — never a home municipality', async () => {
    const result = await signUpStaff(
      client,
      {
        email: ' dana@city.il ',
        password: 'long-enough',
        fullName: ' Dana ',
        preferredLocale: 'ar',
      },
      'https://admin/he/auth/callback',
    );
    expect(result).toEqual({ needsEmailVerification: true });
    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'dana@city.il',
      password: 'long-enough',
      options: {
        emailRedirectTo: 'https://admin/he/auth/callback',
        data: { full_name: 'Dana', preferred_locale: 'ar' },
      },
    });
  });

  it('ignores a home municipality even if one is passed', async () => {
    await signUpStaff(
      client,
      {
        email: 'a@b.il',
        password: 'long-enough',
        fullName: 'Dana',
        preferredLocale: 'he',
        homeMunicipalityId: muni,
      } as never,
      'x',
    );
    const options = auth.signUp.mock.calls.at(-1)![0].options;
    expect(options.data).not.toHaveProperty('home_municipality_id');
  });
});
