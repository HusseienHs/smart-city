import { ApiError, type AttachReportPhotoInput } from '@smart-city/api';
import { messages } from '@smart-city/shared/i18n';
import { describe, expect, it, vi } from 'vitest';

import { draftReducer, EMPTY_DRAFT, type DraftAction, type ReportDraft } from './report-draft';
import {
  ISSUE_MESSAGES,
  sendReport,
  submissionErrorKey,
  type SubmissionServices,
} from './report-submission';

const municipalityId = '6f1f2b9e-6a8f-4d0e-9c8e-1d2a3b4c5d6e';
const reportId = '9c4d5e6f-3a4b-4c5d-8e0f-2a3b4c5d6e7f';
const client = {} as never;
const photoId = (n: number) => `0000000${n}-2f3a-4b5c-9d0e-1f2a3b4c5d6e`;

function draftWithPhotos(count: number): ReportDraft {
  let draft: ReportDraft = {
    ...EMPTY_DRAFT,
    municipalityId,
    category: 'pothole',
    description: 'Deep pothole in the right lane',
    location: { latitude: 32.07, longitude: 34.75, accuracy: 8 },
  };
  for (let n = 1; n <= count; n += 1) {
    draft = draftReducer(draft, {
      type: 'addPhoto',
      photo: { id: photoId(n), uri: `file:///p${n}.jpg`, sizeBytes: 1000, width: 10, height: 10 },
    });
  }
  return draft;
}

/** A persisted store: apply() reduces and records every saved state, like the provider. */
function store(initial: ReportDraft) {
  let current = initial;
  const saved: ReportDraft[] = [];
  const apply = vi.fn(async (action: DraftAction) => {
    current = draftReducer(current, action);
    saved.push(current);
    return current;
  });
  return {
    apply,
    saved,
    get current() {
      return current;
    },
  };
}

function services(overrides: Partial<SubmissionServices> = {}) {
  const attached: AttachReportPhotoInput[] = [];
  const impl: SubmissionServices = {
    submitReport: vi.fn(async () => ({ reportId, trackingNumber: 'TSA-2026-000042' })),
    attachReportPhoto: vi.fn(async (_client, input) => {
      attached.push(input);
      if (!input.uploaded) await input.onUploaded?.();
      return { storagePath: 'x', attachmentId: 'y' };
    }),
    readPhotoBytes: vi.fn(async () => new Uint8Array([1, 2, 3])),
    ...overrides,
  };
  return { impl, attached };
}

const apiError = (code: ConstructorParameters<typeof ApiError>[0], message?: string) =>
  new ApiError(code, { debug: { message } });

describe('sendReport', () => {
  it('submits once, persists the report before any photo, then attaches every photo', async () => {
    const s = store(draftWithPhotos(2));
    const { impl, attached } = services();
    const outcome = await sendReport(client, s.current, s.apply, impl);

    expect(outcome).toEqual({ kind: 'sent' });
    expect(impl.submitReport).toHaveBeenCalledTimes(1);
    expect(s.saved[0]!.submission).toEqual({
      reportId,
      trackingNumber: 'TSA-2026-000042',
      municipalityId,
    });
    expect(s.saved[0]!.photos.every((p) => !p.uploaded)).toBe(true);
    expect(attached.map((a) => [a.photoId, a.reportId, a.municipalityId])).toEqual([
      [photoId(1), reportId, municipalityId],
      [photoId(2), reportId, municipalityId],
    ]);
    expect(s.current.photos.every((p) => p.registered)).toBe(true);
  });

  it('persists "uploaded" as soon as the file is stored', async () => {
    const s = store(draftWithPhotos(1));
    const { impl } = services({
      attachReportPhoto: vi.fn(async (_c, input) => {
        await input.onUploaded?.();
        throw apiError('network');
      }),
    });
    await sendReport(client, s.current, s.apply, impl);
    expect(s.current.photos[0]).toMatchObject({
      uploaded: true,
      registered: false,
      retryable: true,
    });
  });

  it('a retry never submits the report again', async () => {
    const s = store(draftWithPhotos(1));
    const failing = services({
      attachReportPhoto: vi.fn(async () => {
        throw apiError('network');
      }),
    });
    expect(await sendReport(client, s.current, s.apply, failing.impl)).toEqual({
      kind: 'partial',
      failed: 1,
      retryable: true,
    });

    const retry = services();
    expect(await sendReport(client, s.current, s.apply, retry.impl)).toEqual({ kind: 'sent' });
    expect(retry.impl.submitReport).not.toHaveBeenCalled();
  });

  it('a retry of an uploaded photo only registers it: no bytes read, no re-upload', async () => {
    const s = store(draftWithPhotos(1));
    await s.apply({
      type: 'submitted',
      submission: { reportId, trackingNumber: 'TSA-2026-000042', municipalityId },
    });
    await s.apply({ type: 'photoUploaded', id: photoId(1) });

    const { impl, attached } = services();
    await sendReport(client, s.current, s.apply, impl);
    expect(impl.readPhotoBytes).not.toHaveBeenCalled();
    expect(attached[0]).toMatchObject({ uploaded: true, bytes: undefined });
  });

  it('skips photos that are already attached', async () => {
    const s = store(draftWithPhotos(2));
    await s.apply({
      type: 'submitted',
      submission: { reportId, trackingNumber: 'T', municipalityId },
    });
    await s.apply({ type: 'photoRegistered', id: photoId(1) });
    const { impl, attached } = services();
    await sendReport(client, s.current, s.apply, impl);
    expect(attached.map((a) => a.photoId)).toEqual([photoId(2)]);
  });

  it('nothing is created when the report itself fails; the reason is explained', async () => {
    const s = store(draftWithPhotos(1));
    const { impl } = services({
      submitReport: vi.fn(async () => {
        throw apiError('validation', 'The location is outside the municipality');
      }),
    });
    expect(await sendReport(client, s.current, s.apply, impl)).toEqual({
      kind: 'not_sent',
      error: 'reportFlow.outsideMunicipality',
      issue: 'outside_municipality',
    });
    expect(s.saved).toEqual([]);
    expect(impl.attachReportPhoto).not.toHaveBeenCalled();
  });

  it('marks final photo failures as not retryable, others as retryable', async () => {
    const s = store(draftWithPhotos(3));
    let call = 0;
    const { impl } = services({
      attachReportPhoto: vi.fn(async () => {
        call += 1;
        if (call === 1)
          throw apiError(
            'validation',
            'Photos can only be added while the report is newly submitted',
          );
        if (call === 2) throw apiError('network');
        return {};
      }),
    });
    expect(await sendReport(client, s.current, s.apply, impl)).toEqual({
      kind: 'partial',
      failed: 2,
      retryable: true,
    });
    expect(s.current.photos.map((p) => [p.registered, p.error, p.retryable])).toEqual([
      [false, 'reportFlow.photosClosed', false],
      [false, 'apiErrors.network', true],
      [true, null, true],
    ]);
  });

  it('a photo missing from the device fails without retry, and nothing is uploaded for it', async () => {
    const s = store(draftWithPhotos(1));
    const { impl } = services({
      readPhotoBytes: vi.fn(async () => {
        throw new Error('file not found');
      }),
    });
    expect(await sendReport(client, s.current, s.apply, impl)).toEqual({
      kind: 'partial',
      failed: 1,
      retryable: false,
    });
    expect(s.current.photos[0]!.error).toBe('reportFlow.photoUnreadable');
    expect(impl.attachReportPhoto).not.toHaveBeenCalled();
  });

  it('a report without photos is simply sent', async () => {
    const s = store(draftWithPhotos(0));
    expect(await sendReport(client, s.current, s.apply, services().impl)).toEqual({ kind: 'sent' });
  });

  it('reports progress', async () => {
    const s = store(draftWithPhotos(2));
    const progress: unknown[] = [];
    await sendReport(client, s.current, s.apply, services().impl, (p) => progress.push(p));
    expect(progress).toEqual([
      { phase: 'report' },
      { phase: 'photo', current: 1, total: 2 },
      { phase: 'photo', current: 2, total: 2 },
    ]);
  });
});

describe('error messages', () => {
  it('explains known reasons, sign-in and generic failures', () => {
    expect(submissionErrorKey(apiError('rate_limited'))).toBe('reportFlow.rateLimited');
    expect(submissionErrorKey(apiError('unauthorized'))).toBe('reportFlow.signInToSubmit');
    expect(submissionErrorKey(apiError('network'))).toBe('apiErrors.network');
    expect(submissionErrorKey(new Error('x'))).toBe('apiErrors.server');
  });

  it('every message key exists in the translations', () => {
    const keys = [
      ...Object.values(ISSUE_MESSAGES),
      'reportFlow.signInToSubmit',
      'reportFlow.photoUnreadable',
    ];
    for (const key of keys) {
      const value = key!
        .split('.')
        .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], messages.en);
      expect(typeof value).toBe('string');
    }
  });
});
