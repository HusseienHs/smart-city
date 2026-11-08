import { describe, expect, it } from 'vitest';

import { ApiError } from '../errors/api-error';
import { callArgs, fakeClient, type FakeResponse } from '../test-support/fake-client';
import { MY_PHONE_COLUMNS, MY_PROFILE_COLUMNS } from './columns';
import {
  deleteMyPhone,
  getMyPhone,
  getMyProfile,
  getMyReports,
  getMyReportUpdates,
  normalizePhone,
  updateMyProfile,
  upsertMyPhone,
} from './me';

const userId = '11111111-2222-4333-8444-555555555555';
const reportId = '6f1f2b9e-6a8f-4d0e-9c8e-1d2a3b4c5d6e';
const municipalityId = '7a2b3c4d-1e2f-4a5b-8c9d-0e1f2a3b4c5d';
const neighborhoodId = '8b3c4d5e-2f3a-4b5c-9d0e-1f2a3b4c5d6e';

const signedIn = (response: FakeResponse | Error | (FakeResponse | Error)[]) =>
  fakeClient(response, { userId });

const profileRow = {
  id: userId,
  full_name: 'Dana Levi',
  preferred_locale: 'he',
  home_municipality_id: null,
  home_neighborhood_id: null,
};

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

/** Every function with a valid call, for the shared session and error behaviors. */
const allFunctions = [
  ['getMyReports', (c: never) => getMyReports(c)],
  ['getMyReportUpdates', (c: never) => getMyReportUpdates(c, { reportId })],
  ['getMyProfile', (c: never) => getMyProfile(c)],
  ['updateMyProfile', (c: never) => updateMyProfile(c, { fullName: 'Dana' })],
  ['getMyPhone', (c: never) => getMyPhone(c)],
  ['upsertMyPhone', (c: never) => upsertMyPhone(c, { phone: '0501234567' })],
  ['deleteMyPhone', (c: never) => deleteMyPhone(c)],
] as const;

describe.each(allFunctions)('%s: shared behavior', (_name, call) => {
  it('requires a signed-in user and sends nothing without one', async () => {
    const { client, calls } = fakeClient({ data: [] }, { userId: null });
    const error = await failure(call(client as never));
    expect(error.code).toBe('unauthorized');
    expect(calls.filter((c) => c.method !== 'auth.getSession')).toEqual([]);
  });

  it('reports a session failure as a network error', async () => {
    const { client } = fakeClient({ data: [] }, { sessionError: new TypeError('fetch failed') });
    expect((await failure(call(client as never))).code).toBe('network');
  });

  it('maps permission errors to forbidden without leaking details', async () => {
    const { client } = signedIn({
      error: { code: '42501', message: 'permission denied for table', hint: 'GRANT ...' },
      status: 403,
    });
    const error = await failure(call(client as never));
    expect(error.code).toBe('forbidden');
    expect(error.message).not.toContain('permission denied');
  });

  it('maps a failed connection to a network error', async () => {
    const { client } = signedIn(new TypeError('fetch failed'));
    expect((await failure(call(client as never))).code).toBe('network');
  });

  it('never uses select *', async () => {
    const { client, calls } = signedIn({ data: [profileRow] });
    await call(client as never).catch(() => undefined);
    for (const [columns] of callArgs(calls, 'select')) {
      expect(columns).not.toContain('*');
    }
  });
});

describe('getMyReports', () => {
  it('calls get_my_reports and returns rows, keeping NULL fields as null', async () => {
    const row = {
      id: reportId,
      tracking_number: 'TSA-2026-000001',
      category_code: 'pothole',
      status: 'submitted',
      address: null,
      rejection_reason: null,
      resolved_at: null,
    };
    const { client, calls } = signedIn({ data: [row] });
    const reports = await getMyReports(client);
    expect(callArgs(calls, 'rpc')).toEqual([['get_my_reports']]);
    expect(reports).toEqual([row]);
    expect(reports[0]!.address).toBeNull();
  });

  it('returns an empty list when the user has no reports', async () => {
    await expect(getMyReports(signedIn({ data: null }).client)).resolves.toEqual([]);
  });

  it('never reads the reports table directly', async () => {
    const { client, calls } = signedIn({ data: [] });
    await getMyReports(client);
    expect(callArgs(calls, 'from')).toEqual([]);
  });
});

describe('getMyReportUpdates', () => {
  it('calls get_my_report_updates with the report id', async () => {
    const rows = [{ to_status: 'resolved', note: null, created_at: '2026-11-05T10:00:00Z' }];
    const { client, calls } = signedIn({ data: rows });
    await expect(getMyReportUpdates(client, { reportId })).resolves.toEqual(rows);
    expect(callArgs(calls, 'rpc')).toEqual([['get_my_report_updates', { p_report_id: reportId }]]);
  });

  it.each([
    ['a malformed id', { reportId: 'nope' }],
    ['filter-injection text', { reportId: `${reportId},status.eq.closed` }],
    ['a missing id', {}],
  ])('rejects %s before any request', async (_label, input) => {
    const { client, calls } = signedIn({ data: [] });
    const error = await failure(getMyReportUpdates(client, input as never));
    expect(error.code).toBe('validation');
    expect(calls).toEqual([]);
  });
});

describe('getMyProfile', () => {
  it('reads only the own row, with explicit columns', async () => {
    const { client, calls } = signedIn({ data: profileRow });
    await expect(getMyProfile(client)).resolves.toEqual(profileRow);
    expect(callArgs(calls, 'from')).toEqual([['profiles']]);
    expect(callArgs(calls, 'select')).toEqual([[MY_PROFILE_COLUMNS]]);
    expect(callArgs(calls, 'eq')).toEqual([['id', userId]]);
    expect(callArgs(calls, 'maybeSingle')).toHaveLength(1);
  });

  it('returns null when there is no profile row', async () => {
    await expect(getMyProfile(signedIn({ data: null }).client)).resolves.toBeNull();
  });
});

describe('updateMyProfile', () => {
  it('maps fields to the granted columns and filters on the own id', async () => {
    const { client, calls } = signedIn({ data: profileRow });
    await updateMyProfile(client, {
      fullName: '  Dana Levi  ',
      preferredLocale: 'ar',
      homeMunicipalityId: municipalityId,
      homeNeighborhoodId: neighborhoodId,
    });
    expect(callArgs(calls, 'update')).toEqual([
      [
        {
          full_name: 'Dana Levi',
          preferred_locale: 'ar',
          home_municipality_id: municipalityId,
          home_neighborhood_id: neighborhoodId,
        },
      ],
    ]);
    expect(callArgs(calls, 'eq')).toEqual([['id', userId]]);
    expect(callArgs(calls, 'select')).toEqual([[MY_PROFILE_COLUMNS]]);
  });

  it('sends only the fields given', async () => {
    const { client, calls } = signedIn({ data: profileRow });
    await updateMyProfile(client, { preferredLocale: 'en' });
    expect(callArgs(calls, 'update')).toEqual([[{ preferred_locale: 'en' }]]);
  });

  it('clears the neighborhood together with the municipality', async () => {
    const { client, calls } = signedIn({ data: profileRow });
    await updateMyProfile(client, { homeMunicipalityId: null });
    expect(callArgs(calls, 'update')).toEqual([
      [{ home_municipality_id: null, home_neighborhood_id: null }],
    ]);
  });

  it('allows clearing just the neighborhood or the name', async () => {
    const { client, calls } = signedIn({ data: profileRow });
    await updateMyProfile(client, { homeNeighborhoodId: null, fullName: null });
    expect(callArgs(calls, 'update')).toEqual([[{ full_name: null, home_neighborhood_id: null }]]);
  });

  it.each([
    ['an empty update', {}],
    ['an unknown field', { full_name: 'x' }],
    ['a protected field', { id: userId, fullName: 'x' }],
    ['a blank name', { fullName: '   ' }],
    ['a name over 100 characters', { fullName: 'x'.repeat(101) }],
    ['an unsupported language', { preferredLocale: 'fr' }],
    ['a malformed municipality id', { homeMunicipalityId: 'x' }],
    ['a neighborhood without its municipality', { homeNeighborhoodId: neighborhoodId }],
    [
      'a neighborhood while clearing the municipality',
      { homeMunicipalityId: null, homeNeighborhoodId: neighborhoodId },
    ],
  ])('rejects %s before any request', async (_label, input) => {
    const { client, calls } = signedIn({ data: profileRow });
    const error = await failure(updateMyProfile(client, input as never));
    expect(error.code).toBe('validation');
    expect(calls).toEqual([]);
  });

  it('reports a neighborhood of another municipality (FK violation) as validation', async () => {
    const { client } = signedIn({ error: { code: '23503', message: 'violates foreign key' } });
    const error = await failure(
      updateMyProfile(client, {
        homeMunicipalityId: municipalityId,
        homeNeighborhoodId: neighborhoodId,
      }),
    );
    expect(error.code).toBe('validation');
  });

  it('reports not_found when no row was updated', async () => {
    const error = await failure(
      updateMyProfile(signedIn({ data: null }).client, { fullName: 'A B' }),
    );
    expect(error.code).toBe('not_found');
  });
});

describe('phone', () => {
  it('normalizes typed formats', () => {
    expect(normalizePhone(' +972 (50) 123-45.67 ')).toBe('+972501234567');
  });

  it('getMyPhone reads the own row and returns null when none', async () => {
    const { client, calls } = signedIn({ data: { phone: '+972501234567' } });
    await expect(getMyPhone(client)).resolves.toBe('+972501234567');
    expect(callArgs(calls, 'from')).toEqual([['profile_contacts']]);
    expect(callArgs(calls, 'select')).toEqual([[MY_PHONE_COLUMNS]]);
    expect(callArgs(calls, 'eq')).toEqual([['user_id', userId]]);
    await expect(getMyPhone(signedIn({ data: null }).client)).resolves.toBeNull();
  });

  it('upsert updates an existing number without touching user_id', async () => {
    const { client, calls } = signedIn({ data: [{ phone: '0501234567' }] });
    await expect(upsertMyPhone(client, { phone: '050-123-4567' })).resolves.toBe('0501234567');
    expect(callArgs(calls, 'update')).toEqual([[{ phone: '0501234567' }]]);
    expect(callArgs(calls, 'eq')).toEqual([['user_id', userId]]);
    expect(callArgs(calls, 'insert')).toEqual([]);
    expect(callArgs(calls, 'upsert')).toEqual([]);
  });

  it('upsert inserts the own row when there was none', async () => {
    const { client, calls } = signedIn([{ data: [] }, { data: null, status: 201 }]);
    await expect(upsertMyPhone(client, { phone: '0501234567' })).resolves.toBe('0501234567');
    expect(callArgs(calls, 'insert')).toEqual([[{ user_id: userId, phone: '0501234567' }]]);
  });

  it('upsert recovers when a concurrent request inserted first', async () => {
    const { client, calls } = signedIn([
      { data: [] },
      { error: { code: '23505', message: 'duplicate key' }, status: 409 },
      { data: [{ phone: '0501234567' }] },
    ]);
    await expect(upsertMyPhone(client, { phone: '0501234567' })).resolves.toBe('0501234567');
    expect(callArgs(calls, 'update')).toHaveLength(2);
  });

  it('upsert surfaces other insert failures', async () => {
    const { client } = signedIn([
      { data: [] },
      { error: { code: '42501', message: 'new row violates row-level security' }, status: 403 },
    ]);
    expect((await failure(upsertMyPhone(client, { phone: '0501234567' }))).code).toBe('forbidden');
  });

  it.each([['12345'], ['050-12a-4567'], ['1'.repeat(16)], ['++972501234567'], ['']])(
    'rejects the invalid number %s before any request',
    async (phone) => {
      const { client, calls } = signedIn({ data: [] });
      expect((await failure(upsertMyPhone(client, { phone }))).code).toBe('validation');
      expect(calls).toEqual([]);
    },
  );

  it('deleteMyPhone deletes only the own row', async () => {
    const { client, calls } = signedIn({ data: null, status: 204 });
    await expect(deleteMyPhone(client)).resolves.toBeUndefined();
    expect(callArgs(calls, 'from')).toEqual([['profile_contacts']]);
    expect(callArgs(calls, 'delete')).toEqual([[]]);
    expect(callArgs(calls, 'eq')).toEqual([['user_id', userId]]);
  });
});
