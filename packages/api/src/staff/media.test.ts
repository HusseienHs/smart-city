import { describe, expect, it } from 'vitest';

import { ApiError } from '../errors/api-error';
import { callArgs, fakeClient, type FakeResponse } from '../test-support/fake-client';
import {
  getStaffDirectory,
  STAFF_DEPARTMENT_COLUMNS,
  STAFF_NEIGHBORHOOD_COLUMNS,
} from './directory';
import {
  buildCompletionPhotoPath,
  completionPhotoProblem,
  registerCompletionPhoto,
  REPORT_MEDIA_URL_TTL_SECONDS,
  signReportAttachments,
} from './media';

const userId = '11111111-2222-4333-8444-555555555555';
const municipalityId = '7a2b3c4d-1e2f-4a5b-8c9d-0e1f2a3b4c5d';
const reportId = '6f1f2b9e-6a8f-4d0e-9c8e-1d2a3b4c5d6e';
const photoId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

const signedIn = (response: FakeResponse | FakeResponse[] = { data: null }) =>
  fakeClient(response, { userId });

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

const jpeg = {
  id: 'a1',
  storage_path: `${municipalityId}/${reportId}/citizen/1.jpg`,
  mime_type: 'image/jpeg',
};
const heic = {
  id: 'a2',
  storage_path: `${municipalityId}/${reportId}/citizen/2.heic`,
  mime_type: 'image/heic',
};

describe('signReportAttachments', () => {
  it('signs short-lived view and download URLs as the user, per request', async () => {
    const signed = (suffix: string) => ({
      data: [
        { path: jpeg.storage_path, signedUrl: `https://x/1${suffix}`, error: null },
        { path: heic.storage_path, signedUrl: `https://x/2${suffix}`, error: null },
      ],
    });
    const { client, calls } = signedIn([signed('?view'), signed('?download')]);
    const media = await signReportAttachments(client, [jpeg, heic]);

    expect(callArgs(calls, 'storage.from')).toEqual([['report-media'], ['report-media']]);
    expect(callArgs(calls, 'storage.createSignedUrls')).toEqual([
      [[jpeg.storage_path, heic.storage_path], REPORT_MEDIA_URL_TTL_SECONDS, {}],
      [[jpeg.storage_path, heic.storage_path], REPORT_MEDIA_URL_TTL_SECONDS, { download: true }],
    ]);
    expect(REPORT_MEDIA_URL_TTL_SECONDS).toBeLessThanOrEqual(600);
    expect(media).toEqual([
      {
        attachmentId: 'a1',
        viewUrl: 'https://x/1?view',
        downloadUrl: 'https://x/1?download',
        displayable: true,
      },
      // HEIC can't be shown by most browsers: the UI offers the download instead.
      {
        attachmentId: 'a2',
        viewUrl: 'https://x/2?view',
        downloadUrl: 'https://x/2?download',
        displayable: false,
      },
    ]);
  });

  it('leaves files that could not be signed without a URL instead of failing', async () => {
    const response = {
      data: [
        { path: jpeg.storage_path, signedUrl: null, error: 'Object not found' },
        { path: heic.storage_path, signedUrl: 'https://x/2', error: null },
      ],
    };
    const { client } = signedIn([response, response]);
    const media = await signReportAttachments(client, [jpeg, heic]);
    expect(media[0]).toMatchObject({ viewUrl: null, downloadUrl: null });
    expect(media[1]).toMatchObject({ viewUrl: 'https://x/2' });
  });

  it('makes no request without attachments', async () => {
    const { client, calls } = signedIn();
    expect(await signReportAttachments(client, [])).toEqual([]);
    expect(calls).toEqual([]);
  });

  it('reports a storage failure as a server error', async () => {
    const { client } = signedIn({ error: { message: 'boom' } });
    expect((await failure(signReportAttachments(client, [jpeg]))).code).toBe('server');
  });
});

describe('completion photos', () => {
  it('builds the completion path the storage policy and RPC accept', () => {
    expect(
      buildCompletionPhotoPath({
        municipalityId: municipalityId.toUpperCase(),
        reportId,
        photoId,
        mimeType: 'image/heic',
      }),
    ).toBe(`${municipalityId}/${reportId}/completion/${photoId}.heic`);
    expect(() =>
      buildCompletionPhotoPath({
        municipalityId,
        reportId,
        photoId,
        mimeType: 'image/gif' as never,
      }),
    ).toThrow(ApiError);
  });

  it('checks type and size before uploading', () => {
    expect(completionPhotoProblem({ type: 'image/jpeg', size: 1000 })).toBeNull();
    expect(completionPhotoProblem({ type: 'image/gif', size: 1000 })).toBe('type');
    expect(completionPhotoProblem({ type: 'application/pdf', size: 1000 })).toBe('type');
    expect(completionPhotoProblem({ type: 'image/png', size: 0 })).toBe('size');
    expect(completionPhotoProblem({ type: 'image/png', size: 10 * 1024 * 1024 + 1 })).toBe('size');
    expect(completionPhotoProblem({ type: 'image/png', size: 10 * 1024 * 1024 })).toBeNull();
  });

  it('registers a completion photo with the completion kind', async () => {
    const storagePath = `${municipalityId}/${reportId}/completion/${photoId}.jpg`;
    const { client, calls } = signedIn({ data: 'attachment-id' });
    expect(await registerCompletionPhoto(client, { reportId, storagePath })).toBe('attachment-id');
    expect(callArgs(calls, 'rpc')).toEqual([
      [
        'add_report_attachment',
        { p_report_id: reportId, p_storage_path: storagePath, p_kind: 'completion_photo' },
      ],
    ]);
  });

  it('refuses to register a citizen photo path as a completion photo', async () => {
    const { client, calls } = signedIn({ data: 'attachment-id' });
    const error = await failure(
      registerCompletionPhoto(client, {
        reportId,
        storagePath: `${municipalityId}/${reportId}/citizen/${photoId}.jpg`,
      }),
    );
    expect(error.code).toBe('validation');
    expect(callArgs(calls, 'rpc')).toEqual([]);
  });
});

describe('getStaffDirectory', () => {
  it('reads departments and neighborhoods of one municipality, including inactive ones', async () => {
    const name = { he: 'שם', en: 'Name' };
    const { client, calls } = signedIn([
      { data: [{ id: 'd1', municipality_id: municipalityId, name, is_active: false }] },
      { data: [{ id: 'n1', municipality_id: municipalityId, name, is_active: true }] },
      {
        data: [
          {
            id: 'c1',
            code: 'pothole',
            name,
            icon: null,
            default_visibility: 'public',
            sort_order: 1,
          },
        ],
      },
    ]);
    const directory = await getStaffDirectory(client, { municipalityId });
    expect(callArgs(calls, 'from')).toEqual([
      ['departments'],
      ['neighborhoods'],
      ['report_categories'],
    ]);
    expect(callArgs(calls, 'select').slice(0, 2)).toEqual([
      [STAFF_DEPARTMENT_COLUMNS],
      [STAFF_NEIGHBORHOOD_COLUMNS],
    ]);
    expect(callArgs(calls, 'eq')).toEqual([
      ['municipality_id', municipalityId],
      ['municipality_id', municipalityId],
    ]);
    expect(directory).toEqual({
      departments: [{ id: 'd1', name, isActive: false }],
      neighborhoods: [{ id: 'n1', name, isActive: true }],
      categories: [{ id: 'c1', code: 'pothole', name }],
    });
  });
});
