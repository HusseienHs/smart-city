import { describe, expect, it } from 'vitest';

import { ApiError } from '../errors/api-error';
import { callArgs, fakeClient, type FakeResponse } from '../test-support/fake-client';
import {
  acceptStaffInvitation,
  declineStaffInvitation,
  getMyStaffInvitations,
  getMyStaffMemberships,
  isPlatformAdmin,
} from './staff';

const userId = '11111111-2222-4333-8444-555555555555';
const invitationId = '6f1f2b9e-6a8f-4d0e-9c8e-1d2a3b4c5d6e';
const municipalityId = '7a2b3c4d-1e2f-4a5b-8c9d-0e1f2a3b4c5d';
const departmentId = '8b3c4d5e-2f3a-4b5c-9d0e-1f2a3b4c5d6e';
const name = { he: 'עיר', ar: 'مدينة', en: 'City' };

const signedIn = (response: FakeResponse | Error | (FakeResponse | Error)[]) =>
  fakeClient(response, { userId });

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

const membershipRow = {
  employee_id: 'e0000000-0000-4000-8000-000000000001',
  municipality_id: municipalityId,
  municipality_code: 'TLV',
  municipality_name: name,
  municipality_status: 'active',
  role: 'department_manager',
  department_id: departmentId,
  department_name: { he: 'כבישים', ar: 'طرق', en: 'Roads' },
  job_title: 'Head of roads',
};

describe('getMyStaffMemberships', () => {
  it('calls the own-memberships function and keeps department details', async () => {
    const { client, calls } = signedIn({ data: [membershipRow] });
    const memberships = await getMyStaffMemberships(client);
    expect(callArgs(calls, 'rpc')).toEqual([['get_my_staff_memberships']]);
    expect(memberships).toEqual([membershipRow]);
  });

  it('returns null department and job title for roles without them', async () => {
    const { client } = signedIn({
      data: [
        {
          ...membershipRow,
          role: 'intake_dispatcher',
          department_id: null,
          department_name: null,
          job_title: null,
        },
      ],
    });
    const [membership] = await getMyStaffMemberships(client);
    expect(membership).toMatchObject({
      department_id: null,
      department_name: null,
      job_title: null,
    });
  });

  it('an empty list is a valid answer (citizen or deactivated staff)', async () => {
    const { client } = signedIn({ data: [] });
    expect(await getMyStaffMemberships(client)).toEqual([]);
  });

  it('rejects malformed localized names as a server error', async () => {
    const { client } = signedIn({ data: [{ ...membershipRow, municipality_name: 'TLV' }] });
    expect((await failure(getMyStaffMemberships(client))).code).toBe('server');
  });
});

describe('isPlatformAdmin', () => {
  it('reads the own-row-only table', async () => {
    const { client, calls } = signedIn({ data: { user_id: userId } });
    expect(await isPlatformAdmin(client)).toBe(true);
    expect(callArgs(calls, 'from')).toEqual([['platform_admins']]);
  });

  it('is false when no row is visible', async () => {
    const { client } = signedIn({ data: null });
    expect(await isPlatformAdmin(client)).toBe(false);
  });
});

describe('invitations', () => {
  it('lists pending invitations with localized names', async () => {
    const row = {
      id: invitationId,
      municipality_id: municipalityId,
      municipality_name: name,
      role: 'employee',
      department_name: null,
      expires_at: '2026-11-15T10:00:00Z',
    };
    const { client, calls } = signedIn({ data: [row] });
    expect(await getMyStaffInvitations(client)).toEqual([row]);
    expect(callArgs(calls, 'rpc')).toEqual([['get_my_staff_invitations']]);
  });

  it('accepts and declines by id only', async () => {
    const accepted = signedIn({ data: 'e0000000-0000-4000-8000-000000000009' });
    expect(await acceptStaffInvitation(accepted.client, { invitationId })).toBe(
      'e0000000-0000-4000-8000-000000000009',
    );
    expect(callArgs(accepted.calls, 'rpc')).toEqual([
      ['accept_staff_invitation', { p_invitation_id: invitationId }],
    ]);

    const declined = signedIn({ data: null });
    await declineStaffInvitation(declined.client, { invitationId });
    expect(callArgs(declined.calls, 'rpc')).toEqual([
      ['decline_staff_invitation', { p_invitation_id: invitationId }],
    ]);
  });

  it('validates the id before any request', async () => {
    const { client, calls } = signedIn({ data: null });
    expect((await failure(acceptStaffInvitation(client, { invitationId: 'nope' }))).code).toBe(
      'validation',
    );
    expect(calls).toEqual([]);
  });

  it('an invitation that is not the caller’s is forbidden, without details', async () => {
    const { client } = signedIn({
      error: { code: '42501', message: 'Invitation not found or no longer valid' },
      status: 403,
    });
    expect((await failure(acceptStaffInvitation(client, { invitationId }))).code).toBe('forbidden');
  });
});

describe('session', () => {
  it('every function requires a signed-in user', async () => {
    const calls = [
      (c: ReturnType<typeof fakeClient>['client']) => getMyStaffMemberships(c),
      (c: ReturnType<typeof fakeClient>['client']) => isPlatformAdmin(c),
      (c: ReturnType<typeof fakeClient>['client']) => getMyStaffInvitations(c),
      (c: ReturnType<typeof fakeClient>['client']) => acceptStaffInvitation(c, { invitationId }),
      (c: ReturnType<typeof fakeClient>['client']) => declineStaffInvitation(c, { invitationId }),
    ];
    for (const call of calls) {
      const { client, calls: recorded } = fakeClient({ data: [] });
      expect((await failure(call(client))).code).toBe('unauthorized');
      expect(recorded.filter((c) => c.method !== 'auth.getSession')).toEqual([]);
    }
  });
});
