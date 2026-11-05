import { describe, expect, it } from 'vitest';

import { ApiError } from '../errors/api-error';
import { callArgs, fakeClient, type FakeResponse } from '../test-support/fake-client';
import {
  addReportAttachment,
  attachReportPhoto,
  buildReportPhotoPath,
  newReportPhotoId,
  REPORT_MEDIA_BUCKET,
  REPORT_SUBMISSION_MESSAGES,
  reportSubmissionIssue,
  submitReport,
  uploadReportPhoto,
} from './submission';

const userId = '11111111-2222-4333-8444-555555555555';
const municipalityId = '6f1f2b9e-6a8f-4d0e-9c8e-1d2a3b4c5d6e';
const reportId = '7a2b3c4d-1e2f-4a5b-8c9d-0e1f2a3b4c5d';
const photoId = '8b3c4d5e-2f3a-4b5c-9d0e-1f2a3b4c5d6e';
const attachmentId = '9c4d5e6f-3a4b-4c5d-8e0f-2a3b4c5d6e7f';
const path = `${municipalityId}/${reportId}/citizen/${photoId}.jpg`;
const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

const signedIn = (response: FakeResponse | Error | (FakeResponse | Error)[]) =>
  fakeClient(response, { userId });

const storageError = (status: number, message = 'storage error'): FakeResponse => ({
  error: { message, status, statusCode: String(status), __isStorageError: true },
  status,
});

/** The older Storage format: HTTP 400, the real status only in the body's `statusCode`. */
const legacyStorageError = (statusCode: number, message = 'storage error'): FakeResponse => ({
  error: { message, status: 400, statusCode: String(statusCode), __isStorageError: true },
  status: 400,
});

const STORAGE_FORMATS = [
  ['HTTP status', storageError],
  ['HTTP 400 + body statusCode', legacyStorageError],
] as const;

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

const report = {
  municipalityId,
  category: 'pothole',
  description: 'Deep pothole in the right lane, next to the bus stop',
  location: { latitude: 32.0853, longitude: 34.7818, accuracy: 8 },
} as const;

describe('submitReport', () => {
  it('calls submit_report with the mapped arguments and returns the real tracking number', async () => {
    const { client, calls } = signedIn({
      data: [{ report_id: reportId, tracking_number: 'TSA-2026-000042' }],
    });
    await expect(
      submitReport(client, { ...report, address: 'Herzl St 24', visibility: 'private' }),
    ).resolves.toEqual({ reportId, trackingNumber: 'TSA-2026-000042' });
    expect(callArgs(calls, 'rpc')).toEqual([
      [
        'submit_report',
        {
          p_municipality_id: municipalityId,
          p_category_code: 'pothole',
          p_description: report.description,
          p_latitude: 32.0853,
          p_longitude: 34.7818,
          p_location_accuracy_m: 8,
          p_address: 'Herzl St 24',
          p_visibility: 'private',
        },
      ],
    ]);
  });

  it('leaves optional values to the database defaults', async () => {
    const { client, calls } = signedIn({
      data: [{ report_id: reportId, tracking_number: 'TSA-2026-000043' }],
    });
    await submitReport(client, { ...report, location: { latitude: 1, longitude: 2 } });
    const [[, args]] = callArgs(calls, 'rpc') as [[string, Record<string, unknown>]];
    expect(args.p_location_accuracy_m).toBeUndefined();
    expect(args.p_address).toBeUndefined();
    expect(args.p_visibility).toBeUndefined();
  });

  it.each([
    ['a malformed municipality id', { ...report, municipalityId: 'x' }],
    ['an unknown category', { ...report, category: 'graffiti' }],
    ['a short description', { ...report, description: 'short' }],
    ['a description over 2000 characters', { ...report, description: 'x'.repeat(2001) }],
    ['latitude out of range', { ...report, location: { latitude: 91, longitude: 0 } }],
    ['longitude out of range', { ...report, location: { latitude: 0, longitude: 181 } }],
    ['an address over 300 characters', { ...report, address: 'a'.repeat(301) }],
    ['an unknown visibility', { ...report, visibility: 'secret' }],
  ])('rejects %s before any request', async (_label, input) => {
    const { client, calls } = signedIn({ data: [] });
    expect((await failure(submitReport(client, input as never))).code).toBe('validation');
    expect(calls).toEqual([]);
  });

  it('requires a session', async () => {
    const { client, calls } = fakeClient({ data: [] });
    expect((await failure(submitReport(client, report))).code).toBe('unauthorized');
    expect(callArgs(calls, 'rpc')).toEqual([]);
  });

  it('reports the rate limit and the database reasons', async () => {
    const limited = signedIn({
      error: { code: 'P0001', hint: 'rate_limited', message: 'Too many reports' },
      status: 400,
    });
    const rateError = await failure(submitReport(limited.client, report));
    expect(rateError.code).toBe('rate_limited');
    expect(reportSubmissionIssue(rateError)).toBe('rate_limited');

    const outside = signedIn({
      error: { code: '22023', message: 'The location is outside the municipality' },
      status: 400,
    });
    const outsideError = await failure(submitReport(outside.client, report));
    expect(outsideError.code).toBe('validation');
    expect(reportSubmissionIssue(outsideError)).toBe('outside_municipality');
    expect(outsideError.message).not.toContain('outside');
  });

  it('treats an empty RPC result as a server error', async () => {
    expect((await failure(submitReport(signedIn({ data: [] }).client, report))).code).toBe(
      'server',
    );
  });
});

describe('photo ids and paths', () => {
  it('generates RFC 4122 v4 ids from the secure random source, all different', () => {
    const ids = new Set(Array.from({ length: 200 }, () => newReportPhotoId()));
    expect(ids.size).toBe(200);
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
  });

  it('refuses to generate ids without a secure random source (never Math.random)', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto')!;
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    try {
      expect(() => newReportPhotoId()).toThrow(ApiError);
    } finally {
      Object.defineProperty(globalThis, 'crypto', descriptor);
    }
  });

  it('builds the exact path the storage policy and add_report_attachment accept', () => {
    const built = buildReportPhotoPath({
      municipalityId,
      reportId,
      photoId,
      mimeType: 'image/jpeg',
    });
    expect(built).toBe(path);
    // The same pattern as add_report_attachment's check.
    expect(built).toMatch(
      new RegExp(
        `^${municipalityId}/${reportId}/citizen/[0-9a-f-]{36}\\.(jpg|jpeg|png|heic|webp)$`,
      ),
    );
    expect(
      buildReportPhotoPath({
        municipalityId: municipalityId.toUpperCase(),
        reportId,
        photoId,
        mimeType: 'image/heic',
      }),
    ).toBe(`${municipalityId}/${reportId}/citizen/${photoId}.heic`);
  });

  it.each([
    ['a non-image type', { mimeType: 'application/pdf' }],
    ['a GIF', { mimeType: 'image/gif' }],
    ['a path-traversal photo id', { photoId: '../../etc/passwd' }],
    ['a malformed report id', { reportId: 'abc/def' }],
  ])('rejects %s', (_label, override) => {
    expect(() =>
      buildReportPhotoPath({
        municipalityId,
        reportId,
        photoId,
        mimeType: 'image/jpeg',
        ...override,
      } as never),
    ).toThrow(ApiError);
  });
});

describe('uploadReportPhoto', () => {
  const input = { municipalityId, reportId, photoId, mimeType: 'image/jpeg' as const, bytes };

  it('uploads to the private bucket at the fixed path, without overwriting', async () => {
    const { client, calls } = signedIn({ data: { path } });
    await expect(uploadReportPhoto(client, input)).resolves.toEqual({
      storagePath: path,
      alreadyUploaded: false,
    });
    expect(callArgs(calls, 'storage.from')).toEqual([[REPORT_MEDIA_BUCKET]]);
    expect(callArgs(calls, 'storage.upload')).toEqual([
      [path, bytes, { contentType: 'image/jpeg', upsert: false }],
    ]);
  });

  it('treats "already exists" (409) as uploaded: a retry never creates a second file', async () => {
    const { client } = signedIn(storageError(409, 'The resource already exists'));
    await expect(uploadReportPhoto(client, input)).resolves.toEqual({
      storagePath: path,
      alreadyUploaded: true,
    });
  });

  it.each([
    [403, 'forbidden'],
    [413, 'validation'],
    [415, 'validation'],
    [500, 'server'],
  ])('maps storage status %i to %s', async (status, code) => {
    const { client } = signedIn(storageError(status));
    expect((await failure(uploadReportPhoto(client, input))).code).toBe(code);
  });

  it.each(STORAGE_FORMATS)(
    '"already exists" in the %s format counts as uploaded',
    async (_format, make) => {
      const { client } = signedIn(make(409, 'The resource already exists'));
      await expect(uploadReportPhoto(client, input)).resolves.toEqual({
        storagePath: path,
        alreadyUploaded: true,
      });
    },
  );

  it.each(STORAGE_FORMATS)('a refused policy in the %s format is "forbidden"', async (_f, make) => {
    const { client } = signedIn(make(403, 'new row violates row-level security policy'));
    expect((await failure(uploadReportPhoto(client, input))).code).toBe('forbidden');
  });

  it('keeps a genuine HTTP 400 (no numeric body code) as a validation error', async () => {
    for (const statusCode of ['InvalidKey', undefined, '400']) {
      const { client } = signedIn({
        error: { message: 'bad', status: 400, statusCode, __isStorageError: true },
        status: 400,
      });
      expect((await failure(uploadReportPhoto(client, input))).code).toBe('validation');
    }
  });

  it('maps a failed connection to a network error', async () => {
    const lost = signedIn({
      error: { message: 'fetch failed', __isStorageError: true },
    });
    expect((await failure(uploadReportPhoto(lost.client, input))).code).toBe('network');
    const thrown = signedIn(new TypeError('fetch failed'));
    expect((await failure(uploadReportPhoto(thrown.client, input))).code).toBe('network');
  });

  it.each([
    ['an empty file', new Uint8Array()],
    ['a file over 10 MB', new Uint8Array(10 * 1024 * 1024 + 1)],
  ])('rejects %s before uploading', async (_label, data) => {
    const { client, calls } = signedIn({ data: {} });
    expect((await failure(uploadReportPhoto(client, { ...input, bytes: data }))).code).toBe(
      'validation',
    );
    expect(calls).toEqual([]);
  });

  it('accepts ArrayBuffer and Blob bodies', async () => {
    for (const body of [bytes.buffer, new Blob([bytes], { type: 'image/jpeg' })]) {
      const { client } = signedIn({ data: { path } });
      await expect(uploadReportPhoto(client, { ...input, bytes: body })).resolves.toMatchObject({
        storagePath: path,
      });
    }
  });

  it('requires a session', async () => {
    expect((await failure(uploadReportPhoto(fakeClient({}).client, input))).code).toBe(
      'unauthorized',
    );
  });
});

describe('addReportAttachment', () => {
  it('registers the path and returns the attachment id', async () => {
    const { client, calls } = signedIn({ data: attachmentId });
    await expect(addReportAttachment(client, { reportId, storagePath: path })).resolves.toEqual({
      attachmentId,
      alreadyRegistered: false,
    });
    expect(callArgs(calls, 'rpc')).toEqual([
      ['add_report_attachment', { p_report_id: reportId, p_storage_path: path }],
    ]);
  });

  it('treats an already registered path as registered (no duplicate row)', async () => {
    const { client, calls } = signedIn([
      { error: { code: '23505', message: 'duplicate key' }, status: 409 },
      { data: [{ id: attachmentId, storage_path: path, kind: 'citizen_photo' }] },
    ]);
    await expect(addReportAttachment(client, { reportId, storagePath: path })).resolves.toEqual({
      attachmentId,
      alreadyRegistered: true,
    });
    expect(callArgs(calls, 'rpc')[1]).toEqual([
      'get_my_report_attachments',
      { p_report_id: reportId },
    ]);
  });

  it('explains photo-step refusals', async () => {
    for (const [issue, messages] of Object.entries(REPORT_SUBMISSION_MESSAGES)) {
      if (!issue.startsWith('photo')) continue;
      const { client } = signedIn({ error: { code: '22023', message: messages[0] }, status: 400 });
      const error = await failure(addReportAttachment(client, { reportId, storagePath: path }));
      expect(reportSubmissionIssue(error)).toBe(issue);
    }
  });

  it('rejects malformed input before any request', async () => {
    const { client, calls } = signedIn({ data: attachmentId });
    expect(
      (await failure(addReportAttachment(client, { reportId: 'x', storagePath: path }))).code,
    ).toBe('validation');
    expect(calls).toEqual([]);
  });
});

describe('attachReportPhoto (upload + register, safe to repeat)', () => {
  const input = { municipalityId, reportId, photoId, mimeType: 'image/jpeg' as const, bytes };

  it('uploads, then registers', async () => {
    const { client, calls } = signedIn([{ data: { path } }, { data: attachmentId }]);
    await expect(attachReportPhoto(client, input)).resolves.toEqual({
      storagePath: path,
      attachmentId,
    });
    expect(callArgs(calls, 'storage.upload')).toHaveLength(1);
    expect(callArgs(calls, 'rpc')).toEqual([
      ['add_report_attachment', { p_report_id: reportId, p_storage_path: path }],
    ]);
  });

  it('reports the stored file (onUploaded) before registering, so it can be persisted', async () => {
    const order: string[] = [];
    const { client, calls } = signedIn([{ data: { path } }, { data: attachmentId }]);
    await attachReportPhoto(client, {
      ...input,
      onUploaded: () => {
        order.push(`uploaded after ${callArgs(calls, 'storage.upload').length} upload(s)`);
        order.push(`registrations so far: ${callArgs(calls, 'rpc').length}`);
      },
    });
    expect(order).toEqual(['uploaded after 1 upload(s)', 'registrations so far: 0']);
  });

  it('does not report an upload that failed, or one that was skipped', async () => {
    let calls = 0;
    const onUploaded = () => {
      calls += 1;
    };
    const failing = signedIn(new TypeError('fetch failed'));
    await attachReportPhoto(failing.client, { ...input, onUploaded }).catch(() => undefined);
    const skipped = signedIn({ data: attachmentId });
    await attachReportPhoto(skipped.client, {
      ...input,
      bytes: undefined,
      uploaded: true,
      onUploaded,
    });
    expect(calls).toBe(0);
  });

  it('needs no photo data once uploaded, but requires it before', async () => {
    const { client } = signedIn({ data: attachmentId });
    await expect(
      attachReportPhoto(client, { ...input, bytes: undefined, uploaded: true }),
    ).resolves.toMatchObject({ attachmentId });

    const missing = signedIn({ data: attachmentId });
    expect(
      (await failure(attachReportPhoto(missing.client, { ...input, bytes: undefined }))).code,
    ).toBe('validation');
    expect(missing.calls).toEqual([]);
  });

  it('skips the upload when an earlier attempt already uploaded the file', async () => {
    const { client, calls } = signedIn({ data: attachmentId });
    await attachReportPhoto(client, { ...input, uploaded: true });
    expect(callArgs(calls, 'storage.upload')).toEqual([]);
  });

  it('a retry after a lost response neither re-uploads nor re-registers twice', async () => {
    const { client, calls } = signedIn([
      storageError(409, 'The resource already exists'),
      { error: { code: '23505', message: 'duplicate key' }, status: 409 },
      { data: [{ id: attachmentId, storage_path: path, kind: 'citizen_photo' }] },
    ]);
    await expect(attachReportPhoto(client, input)).resolves.toEqual({
      storagePath: path,
      attachmentId,
    });
    expect(callArgs(calls, 'storage.upload')).toHaveLength(1);
  });

  it.each(STORAGE_FORMATS)(
    'retry after a lost upload response (%s format): one upload, one registration, no error',
    async (_format, make) => {
      const onUploaded = { count: 0 };
      const { client, calls } = signedIn([
        make(409, 'The resource already exists'),
        { data: attachmentId },
      ]);
      await expect(
        attachReportPhoto(client, { ...input, onUploaded: () => void onUploaded.count++ }),
      ).resolves.toEqual({ storagePath: path, attachmentId });
      expect(callArgs(calls, 'storage.upload')).toHaveLength(1);
      expect(callArgs(calls, 'rpc')).toEqual([
        ['add_report_attachment', { p_report_id: reportId, p_storage_path: path }],
      ]);
      // "Already stored" is persisted like a fresh upload, so the next retry sends no bytes.
      expect(onUploaded.count).toBe(1);
    },
  );

  it.each(STORAGE_FORMATS)(
    'upload refused (%s format) but the file exists: registration succeeds',
    async (_format, make) => {
      const { client } = signedIn([make(403), { data: attachmentId }]);
      await expect(attachReportPhoto(client, input)).resolves.toEqual({
        storagePath: path,
        attachmentId,
      });
    },
  );

  it('upload refused in the HTTP 400 format and the file is missing: "forbidden" is reported', async () => {
    const { client } = signedIn([
      legacyStorageError(403),
      { error: { code: '22023', message: 'The file has not been uploaded' }, status: 400 },
    ]);
    expect((await failure(attachReportPhoto(client, input))).code).toBe('forbidden');
  });

  it('when the upload is refused but the file exists (5-object check), registration succeeds', async () => {
    const { client } = signedIn([storageError(403), { data: attachmentId }]);
    await expect(attachReportPhoto(client, input)).resolves.toEqual({
      storagePath: path,
      attachmentId,
    });
  });

  it('when the upload is refused and the file does not exist, the upload error is reported', async () => {
    const { client } = signedIn([
      storageError(403),
      { error: { code: '22023', message: 'The file has not been uploaded' }, status: 400 },
    ]);
    expect((await failure(attachReportPhoto(client, input))).code).toBe('forbidden');
  });

  it('a network failure during upload is reported (nothing registered)', async () => {
    const { client, calls } = signedIn(new TypeError('fetch failed'));
    expect((await failure(attachReportPhoto(client, input))).code).toBe('network');
    expect(callArgs(calls, 'rpc')).toEqual([]);
  });
});

describe('reportSubmissionIssue', () => {
  it('ignores non-API and unknown errors', () => {
    expect(reportSubmissionIssue(new Error('x'))).toBeNull();
    expect(reportSubmissionIssue(new ApiError('server'))).toBeNull();
    expect(
      reportSubmissionIssue(new ApiError('validation', { debug: { message: 'something else' } })),
    ).toBeNull();
  });
});
