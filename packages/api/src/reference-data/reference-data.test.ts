import { describe, expect, it } from 'vitest';

import { ApiError } from '../errors/api-error';
import { callArgs, fakeClient } from '../test-support/fake-client';
import {
  ANNOUNCEMENT_COLUMNS,
  DEPARTMENT_COLUMNS,
  MUNICIPALITY_COLUMNS,
  MUNICIPALITY_REPORT_CATEGORY_SELECT,
  NEIGHBORHOOD_COLUMNS,
  REPORT_CATEGORY_COLUMNS,
} from './columns';
import {
  acceptsReports,
  listCities,
  listDepartments,
  listMunicipalityReportCategories,
  listNeighborhoods,
  listPublishedAnnouncements,
  listReportCategories,
  listReportingMunicipalities,
} from './reference-data';

const municipalityId = '6f1f2b9e-6a8f-4d0e-9c8e-1d2a3b4c5d6e';
const neighborhoodId = '7a2b3c4d-1e2f-4a5b-8c9d-0e1f2a3b4c5d';
const name = { he: 'שם', en: 'Name' };

const scope = { municipalityId };

/** Every function, with a valid call and a representative row, for the shared behaviors. */
const allFunctions = [
  ['listReportingMunicipalities', (c: never) => listReportingMunicipalities(c), { id: 'm', name }],
  ['listCities', (c: never) => listCities(c), { id: 'm', name }],
  ['listNeighborhoods', (c: never) => listNeighborhoods(c, scope), { id: 'n', name }],
  ['listDepartments', (c: never) => listDepartments(c, scope), { id: 'd', name }],
  ['listReportCategories', (c: never) => listReportCategories(c), { id: 'c', name }],
  [
    'listMunicipalityReportCategories',
    (c: never) => listMunicipalityReportCategories(c, scope),
    { category_id: 'c', category: { id: 'c', name, sort_order: 1 } },
  ],
  [
    'listPublishedAnnouncements',
    (c: never) => listPublishedAnnouncements(c, scope),
    { id: 'a', title: name, body: name },
  ],
] as const;

const scoped = [
  ['listNeighborhoods', listNeighborhoods],
  ['listDepartments', listDepartments],
  ['listMunicipalityReportCategories', listMunicipalityReportCategories],
  ['listPublishedAnnouncements', listPublishedAnnouncements],
] as const;

describe.each(allFunctions)('%s: shared behavior', (_name, call, row) => {
  const run = (response: Parameters<typeof fakeClient>[0]) => {
    const { client, calls } = fakeClient(response);
    return { calls, result: call(client as never) };
  };

  it('returns rows on success', async () => {
    const rows = await run({ data: [row] }).result;
    expect(rows).toHaveLength(1);
  });

  it('never uses select *', async () => {
    const { calls, result } = run({ data: [] });
    await result;
    const [selectArgs] = callArgs(calls, 'select');
    expect(selectArgs![0]).toEqual(expect.any(String));
    expect(selectArgs![0]).not.toContain('*');
  });

  it('returns an empty list when nothing matches or RLS hides every row', async () => {
    await expect(run({ data: [] }).result).resolves.toEqual([]);
    await expect(run({ data: null }).result).resolves.toEqual([]);
  });

  it('turns a permission-denied response into a forbidden ApiError', async () => {
    const error = await run({
      error: { code: '42501', message: 'permission denied for table', hint: 'GRANT SELECT ...' },
      status: 403,
    }).result.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('forbidden');
    expect((error as ApiError).message).not.toContain('permission denied');
  });

  it('turns other database errors into a server ApiError', async () => {
    const error = await run({
      error: { code: 'XX000', message: 'internal database detail' },
      status: 500,
    }).result.catch((e: unknown) => e);
    expect((error as ApiError).code).toBe('server');
    expect((error as ApiError).message).not.toContain('internal');
    expect((error as ApiError).debug.message).toBe('internal database detail');
  });

  it('reports a failed connection as a network ApiError', async () => {
    const resolved = await run({
      error: { code: '', message: 'TypeError: fetch failed' },
      status: 0,
    }).result.catch((e: unknown) => e);
    expect((resolved as ApiError).code).toBe('network');

    const thrown = await run(new TypeError('fetch failed')).result.catch((e: unknown) => e);
    expect((thrown as ApiError).code).toBe('network');
  });

  it('rejects a malformed localized-text value in the response', async () => {
    const malformed = JSON.parse(JSON.stringify(row).replaceAll('"שם"', '""')) as object;
    const error = await run({ data: [malformed] }).result.catch((e: unknown) => e);
    expect((error as ApiError).code).toBe('server');
  });
});

describe.each(scoped)('%s: input validation', (_name, fn) => {
  it.each([
    ['a malformed id', { municipalityId: 'not-a-uuid' }],
    ['an empty id', { municipalityId: '' }],
    ['filter-injection text', { municipalityId: `${municipalityId},status.eq.draft` }],
    ['a missing id', {}],
  ])('rejects %s without sending a query', async (_label, input) => {
    const { client, calls } = fakeClient({ data: [] });
    const error = await fn(client, input as never).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('validation');
    expect((error as ApiError).issues[0]?.path).toBe('municipalityId');
    expect(calls).toEqual([]);
  });
});

describe('query shapes', () => {
  const firstArgs = (calls: Parameters<typeof callArgs>[0], method: string) =>
    callArgs(calls, method);

  it('listReportingMunicipalities: active only, explicit columns, no boundary', async () => {
    const { client, calls } = fakeClient({ data: [] });
    await listReportingMunicipalities(client);
    expect(firstArgs(calls, 'from')).toEqual([['municipalities']]);
    expect(firstArgs(calls, 'select')).toEqual([[MUNICIPALITY_COLUMNS]]);
    expect(firstArgs(calls, 'eq')).toEqual([['status', 'active']]);
    expect(MUNICIPALITY_COLUMNS).not.toContain('boundary');
  });

  it('listCities: active and onboarding, never suspended', async () => {
    const { client, calls } = fakeClient({ data: [] });
    await listCities(client);
    expect(firstArgs(calls, 'from')).toEqual([['municipalities']]);
    expect(firstArgs(calls, 'select')).toEqual([[MUNICIPALITY_COLUMNS]]);
    expect(firstArgs(calls, 'in')).toEqual([['status', ['active', 'onboarding']]]);
  });

  it('acceptsReports: only active municipalities', () => {
    expect(acceptsReports({ status: 'active' })).toBe(true);
    expect(acceptsReports({ status: 'onboarding' })).toBe(false);
    expect(acceptsReports({ status: 'suspended' })).toBe(false);
  });

  it('listNeighborhoods and listDepartments: scoped and active only', async () => {
    for (const [fn, table, columns] of [
      [listNeighborhoods, 'neighborhoods', NEIGHBORHOOD_COLUMNS],
      [listDepartments, 'departments', DEPARTMENT_COLUMNS],
    ] as const) {
      const { client, calls } = fakeClient({ data: [] });
      await fn(client, scope);
      expect(firstArgs(calls, 'from')).toEqual([[table]]);
      expect(firstArgs(calls, 'select')).toEqual([[columns]]);
      expect(firstArgs(calls, 'eq')).toEqual([
        ['municipality_id', municipalityId],
        ['is_active', true],
      ]);
    }
    expect(NEIGHBORHOOD_COLUMNS).not.toContain('boundary');
  });

  it('listReportCategories: active only, in display order', async () => {
    const { client, calls } = fakeClient({ data: [] });
    await listReportCategories(client);
    expect(firstArgs(calls, 'select')).toEqual([[REPORT_CATEGORY_COLUMNS]]);
    expect(firstArgs(calls, 'eq')).toEqual([['is_active', true]]);
    expect(firstArgs(calls, 'order')).toEqual([['sort_order']]);
  });

  it('listMunicipalityReportCategories: enabled only, inner join, sorted by category order', async () => {
    const { client, calls } = fakeClient({
      data: [
        { category_id: 'b', category: { id: 'b', name, sort_order: 20 } },
        { category_id: 'a', category: { id: 'a', name, sort_order: 10 } },
      ],
    });
    const rows = await listMunicipalityReportCategories(client, scope);
    expect(rows.map((row) => row.category_id)).toEqual(['a', 'b']);
    expect(firstArgs(calls, 'select')).toEqual([[MUNICIPALITY_REPORT_CATEGORY_SELECT]]);
    expect(MUNICIPALITY_REPORT_CATEGORY_SELECT).toContain('report_categories!inner');
    expect(firstArgs(calls, 'eq')).toEqual([
      ['municipality_id', municipalityId],
      ['is_enabled', true],
    ]);
  });
});

describe('listPublishedAnnouncements', () => {
  const now = new Date('2026-11-04T10:00:00.000Z');
  const expiryFilter = 'expires_at.is.null,expires_at.gt."2026-11-04T10:00:00.000Z"';

  it('never requests author ids', () => {
    expect(ANNOUNCEMENT_COLUMNS).not.toContain('created_by');
    expect(ANNOUNCEMENT_COLUMNS).not.toContain('published_by');
  });

  it('returns only published, unexpired, municipality-wide items by default, newest first', async () => {
    const { client, calls } = fakeClient({ data: [] });
    await listPublishedAnnouncements(client, { municipalityId, now });
    expect(callArgs(calls, 'select')).toEqual([[ANNOUNCEMENT_COLUMNS]]);
    expect(callArgs(calls, 'eq')).toEqual([
      ['municipality_id', municipalityId],
      ['status', 'published'],
    ]);
    expect(callArgs(calls, 'or')).toEqual([[expiryFilter]]);
    expect(callArgs(calls, 'is')).toEqual([['neighborhood_id', null]]);
    expect(callArgs(calls, 'order')).toEqual([['published_at', { ascending: false }]]);
    expect(callArgs(calls, 'limit')).toEqual([[50]]);
  });

  it('adds neighborhood items when a neighborhood is given', async () => {
    const { client, calls } = fakeClient({ data: [] });
    await listPublishedAnnouncements(client, { municipalityId, neighborhoodId, now, limit: 10 });
    expect(callArgs(calls, 'or')).toEqual([
      [expiryFilter],
      [`neighborhood_id.is.null,neighborhood_id.eq.${neighborhoodId}`],
    ]);
    expect(callArgs(calls, 'is')).toEqual([]);
    expect(callArgs(calls, 'limit')).toEqual([[10]]);
  });

  it('narrows localized title and body', async () => {
    const { client } = fakeClient({ data: [{ id: 'a', title: name, body: { he: 'תוכן' } }] });
    const [row] = await listPublishedAnnouncements(client, { municipalityId, now });
    expect(row).toMatchObject({ title: name, body: { he: 'תוכן' } });
  });

  it.each([
    [
      'filter injection through the neighborhood',
      { neighborhoodId: `${neighborhoodId}),or(id.not.is.null` },
    ],
    ['a zero limit', { limit: 0 }],
    ['an excessive limit', { limit: 1000 }],
    ['a fractional limit', { limit: 1.5 }],
  ])('rejects %s without sending a query', async (_label, extra) => {
    const { client, calls } = fakeClient({ data: [] });
    const error = await listPublishedAnnouncements(client, { municipalityId, ...extra }).catch(
      (e: unknown) => e,
    );
    expect((error as ApiError).code).toBe('validation');
    expect(calls).toEqual([]);
  });
});
