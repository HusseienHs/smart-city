import { describe, expect, it } from 'vitest';

import { ApiError } from '../errors/api-error';
import { callArgs, fakeClient } from '../test-support/fake-client';
import { getMyReportAttachments, getMyReportPhotos } from './report-media';

const userId = '11111111-2222-4333-8444-555555555555';
const reportId = '6f1f2b9e-6a8f-4d0e-9c8e-1d2a3b4c5d6e';
const attachment = (id: string, path: string) => ({
  id,
  kind: 'citizen_photo',
  storage_path: path,
  created_at: '2026-11-10T08:00:00Z',
});

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

describe('getMyReportAttachments', () => {
  it('calls get_my_report_attachments for the report', async () => {
    const { client, calls } = fakeClient({ data: [attachment('a', 'm/r/a.jpg')] }, { userId });
    expect(await getMyReportAttachments(client as never, { reportId })).toHaveLength(1);
    expect(callArgs(calls, 'rpc')).toEqual([
      ['get_my_report_attachments', { p_report_id: reportId }],
    ]);
  });

  it('validates the id and requires a session', async () => {
    const bad = fakeClient({ data: [] }, { userId });
    expect(
      (await failure(getMyReportAttachments(bad.client as never, { reportId: 'x' }))).code,
    ).toBe('validation');
    expect(bad.calls).toEqual([]);
    const anon = fakeClient({ data: [] }, { userId: null });
    expect((await failure(getMyReportAttachments(anon.client as never, { reportId }))).code).toBe(
      'unauthorized',
    );
  });
});

describe('getMyReportPhotos', () => {
  it('signs the photos as the caller, short-lived, and keeps unsigned ones as null', async () => {
    const { client, calls } = fakeClient(
      [
        { data: [attachment('a', 'm/r/a.jpg'), attachment('b', 'm/r/b.jpg')] },
        { data: [{ path: 'm/r/a.jpg', signedUrl: 'https://signed/a', error: null }] },
      ],
      { userId },
    );
    expect(await getMyReportPhotos(client as never, { reportId })).toEqual([
      { attachmentId: 'a', kind: 'citizen_photo', url: 'https://signed/a' },
      { attachmentId: 'b', kind: 'citizen_photo', url: null },
    ]);
    expect(callArgs(calls, 'storage.from')).toEqual([['report-media']]);
    const [[paths, ttl]] = callArgs(calls, 'storage.createSignedUrls') as [[string[], number]];
    expect(paths).toEqual(['m/r/a.jpg', 'm/r/b.jpg']);
    expect(ttl).toBe(300);
  });

  it('signs nothing when the report has no attachments (or is not the caller’s)', async () => {
    const { client, calls } = fakeClient({ data: [] }, { userId });
    expect(await getMyReportPhotos(client as never, { reportId })).toEqual([]);
    expect(callArgs(calls, 'storage.createSignedUrls')).toEqual([]);
  });
});
