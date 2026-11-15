import { describe, expect, it } from 'vitest';

import { ApiError } from '../errors/api-error';
import { callArgs, fakeClient } from '../test-support/fake-client';
import { getPublicReports } from './public-reports';

const userId = '11111111-2222-4333-8444-555555555555';
const municipalityId = '7a2b3c4d-1e2f-4a5b-8c9d-0e1f2a3b4c5d';
const otherMunicipality = '8b3c4d5e-2f3a-4b5c-9d0e-1f2a3b4c5d6e';
const area = { municipalityId, south: 32.0, west: 34.7, north: 32.1, east: 34.8 };

const row = (id: string, muni = municipalityId) => ({
  id,
  municipality_id: muni,
  category_code: 'pothole',
  status: 'submitted',
  latitude: 32.05,
  longitude: 34.75,
  reported_on: '2026-11-10',
  confirmation_count: 2,
});

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

describe('getPublicReports', () => {
  it('calls get_public_reports with the area and returns the rows', async () => {
    const { client, calls } = fakeClient({ data: [row('a')] }, { userId });
    const rows = await getPublicReports(client as never, { ...area, limit: 100 });
    expect(rows.map((r) => r.id)).toEqual(['a']);
    expect(callArgs(calls, 'rpc')).toEqual([
      [
        'get_public_reports',
        {
          p_municipality_id: municipalityId,
          p_south: 32.0,
          p_west: 34.7,
          p_north: 32.1,
          p_east: 34.8,
          p_limit: 100,
        },
      ],
    ]);
  });

  it('drops rows of any other municipality (defense in depth)', async () => {
    const { client } = fakeClient({ data: [row('a'), row('b', otherMunicipality)] }, { userId });
    expect((await getPublicReports(client as never, area)).map((r) => r.id)).toEqual(['a']);
  });

  it('validates the area before sending anything', async () => {
    for (const bad of [
      { ...area, north: area.south },
      { ...area, east: area.west - 0.1 },
      { ...area, north: area.south + 0.6 },
      { ...area, east: area.west + 0.51 },
      { ...area, municipalityId: 'nope' },
      { ...area, limit: 501 },
      { ...area, south: -91 },
    ]) {
      const { client, calls } = fakeClient({ data: [] }, { userId });
      expect((await failure(getPublicReports(client as never, bad))).code).toBe('validation');
      expect(calls).toEqual([]);
    }
  });

  it('requires a signed-in user', async () => {
    const { client, calls } = fakeClient({ data: [] }, { userId: null });
    expect((await failure(getPublicReports(client as never, area))).code).toBe('unauthorized');
    expect(callArgs(calls, 'rpc')).toEqual([]);
  });

  it('maps database errors', async () => {
    const { client } = fakeClient(
      { error: { code: '22023', message: 'Invalid or too large map area' } },
      { userId },
    );
    expect((await failure(getPublicReports(client as never, area))).code).toBe('validation');
  });
});
