import { MAX_REPORT_PHOTOS, REPORT_CATEGORIES } from '@smart-city/shared';
import { messages } from '@smart-city/shared/i18n';
import { describe, expect, it } from 'vitest';

import {
  DESCRIPTION_MAX_LENGTH,
  DESCRIPTION_MIN_LENGTH,
  draftReducer,
  draftStorageKey,
  EMPTY_DRAFT,
  firstInvalidStep,
  formatFileSize,
  isDraftStarted,
  parseStoredDraft,
  photoProgress,
  REPORT_STEPS,
  serializeDraft,
  toSubmitReportInput,
  validateStep,
  type DraftAction,
  type NewDraftPhoto,
  type ReportDraft,
} from './report-draft';

const municipalityId = '6f1f2b9e-6a8f-4d0e-9c8e-1d2a3b4c5d6e';
const otherMunicipalityId = '7a2b3c4d-1e2f-4a5b-8c9d-0e1f2a3b4c5d';
const reportId = '9c4d5e6f-3a4b-4c5d-8e0f-2a3b4c5d6e7f';

const photo = (n: number): NewDraftPhoto => ({
  id: `0000000${n}-2f3a-4b5c-9d0e-1f2a3b4c5d6e`,
  uri: `file:///cache/photo-${n}.jpg`,
  sizeBytes: 350_000,
  width: 1600,
  height: 1200,
});

const reduce = (...actions: DraftAction[]) => actions.reduce(draftReducer, EMPTY_DRAFT);

const complete: ReportDraft = reduce(
  { type: 'setMunicipality', municipalityId },
  { type: 'setCategory', category: 'pothole' },
  { type: 'setDescription', description: '  Deep pothole in the right lane  ' },
  { type: 'setLocation', location: { latitude: 32.0853, longitude: 34.7818, accuracy: 8 } },
  { type: 'setAddress', address: ' Herzl St 24 ' },
  { type: 'addPhoto', photo: photo(1) },
);

const submission = { reportId, trackingNumber: 'TSA-2026-000042', municipalityId };

function lookup(key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => {
    return typeof node === 'object' && node !== null
      ? (node as Record<string, unknown>)[part]
      : undefined;
  }, messages.en);
}

describe('draftReducer', () => {
  it('builds the draft step by step', () => {
    expect(complete).toMatchObject({ municipalityId, category: 'pothole' });
    expect(complete.photos[0]).toMatchObject({
      mimeType: 'image/jpeg',
      uploaded: false,
      registered: false,
      error: null,
    });
    expect(isDraftStarted(complete)).toBe(true);
    expect(isDraftStarted(EMPTY_DRAFT)).toBe(false);
  });

  it('clears the category when the municipality changes (categories differ per municipality)', () => {
    const changed = draftReducer(complete, {
      type: 'setMunicipality',
      municipalityId: otherMunicipalityId,
    });
    expect(changed.category).toBeNull();
    expect(draftReducer(complete, { type: 'setMunicipality', municipalityId })).toBe(complete);
  });

  it('caps photos at the shared limit and ignores duplicates', () => {
    let draft = EMPTY_DRAFT;
    for (let n = 1; n <= MAX_REPORT_PHOTOS + 2; n += 1) {
      draft = draftReducer(draft, { type: 'addPhoto', photo: photo(Math.min(n, 9)) });
    }
    draft = draftReducer(draft, { type: 'addPhoto', photo: photo(1) });
    expect(draft.photos).toHaveLength(MAX_REPORT_PHOTOS);
  });

  it('tracks each photo: uploaded, registered, failed', () => {
    const id = photo(1).id;
    let draft = draftReducer(complete, { type: 'submitted', submission });
    draft = draftReducer(draft, {
      type: 'photoFailed',
      id,
      error: 'apiErrors.network',
      retryable: true,
    });
    expect(draft.photos[0]).toMatchObject({ uploaded: false, error: 'apiErrors.network' });
    draft = draftReducer(draft, { type: 'photoUploaded', id });
    expect(draft.photos[0]).toMatchObject({ uploaded: true, registered: false });
    draft = draftReducer(draft, { type: 'photoRegistered', id });
    expect(draft.photos[0]).toMatchObject({ uploaded: true, registered: true, error: null });
    expect(photoProgress(draft)).toEqual({ total: 1, registered: 1, failed: 0 });
  });

  it('locks the content once the report was sent', () => {
    const sent = draftReducer(complete, { type: 'submitted', submission });
    for (const action of [
      { type: 'setMunicipality', municipalityId: otherMunicipalityId },
      { type: 'setCategory', category: 'garbage' },
      { type: 'setDescription', description: 'Changed after sending' },
      { type: 'setLocation', location: null },
      { type: 'setAddress', address: 'Elsewhere' },
      { type: 'addPhoto', photo: photo(2) },
      { type: 'setVisibility', visibility: 'private' },
      { type: 'submitted', submission: { ...submission, reportId: otherMunicipalityId } },
    ] as DraftAction[]) {
      expect(draftReducer(sent, action)).toBe(sent);
    }
  });

  it('after sending, only never-uploaded photos can be removed (to finish without them)', () => {
    let sent = reduce(
      { type: 'setMunicipality', municipalityId },
      { type: 'addPhoto', photo: photo(1) },
      { type: 'addPhoto', photo: photo(2) },
      { type: 'addPhoto', photo: photo(3) },
      { type: 'submitted', submission },
      { type: 'photoRegistered', id: photo(1).id },
      { type: 'photoUploaded', id: photo(2).id },
    );
    sent = draftReducer(sent, { type: 'removePhoto', id: photo(1).id });
    sent = draftReducer(sent, { type: 'removePhoto', id: photo(2).id });
    sent = draftReducer(sent, { type: 'removePhoto', id: photo(3).id });
    expect(sent.photos.map((p) => p.id)).toEqual([photo(1).id, photo(2).id]);
  });

  it('resets and restores', () => {
    expect(draftReducer(complete, { type: 'reset' })).toEqual(EMPTY_DRAFT);
    expect(draftReducer(EMPTY_DRAFT, { type: 'restore', draft: complete })).toBe(complete);
  });
});

describe('formatFileSize', () => {
  it('never shows a small photo as 0', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(850)).toBe('850 B');
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(19_100)).toBe('19 KB');
    expect(formatFileSize(350_000)).toBe('342 KB');
    expect(formatFileSize(1000 * 1024 - 1)).toBe('1000 KB');
    expect(formatFileSize(1000 * 1024)).toBe('1.0 MB');
    expect(formatFileSize(2.46 * 1024 * 1024)).toBe('2.5 MB');
  });
});

describe('validation', () => {
  it('requires a municipality, then a category', () => {
    expect(validateStep('category', EMPTY_DRAFT)).toEqual({
      municipality: 'reportFlow.chooseMunicipality',
    });
    expect(validateStep('category', reduce({ type: 'setMunicipality', municipalityId }))).toEqual({
      category: 'reportFlow.errors.categoryRequired',
    });
  });

  it('enforces the shared description length (trimmed)', () => {
    const at = (text: string) => validateStep('details', { ...EMPTY_DRAFT, description: text });
    expect(at(`  ${'x'.repeat(DESCRIPTION_MIN_LENGTH - 1)}  `).description).toBe(
      'reportFlow.errors.descriptionTooShort',
    );
    expect(at('x'.repeat(DESCRIPTION_MIN_LENGTH))).toEqual({});
    expect(at('x'.repeat(DESCRIPTION_MAX_LENGTH + 1)).description).toBe(
      'reportFlow.errors.descriptionTooLong',
    );
  });

  it('requires GPS coordinates; the address is optional but limited', () => {
    expect(validateStep('location', EMPTY_DRAFT)).toEqual({
      location: 'reportFlow.errors.locationRequired',
    });
    const located = reduce({ type: 'setLocation', location: { latitude: 1, longitude: 2 } });
    expect(validateStep('location', located)).toEqual({});
    expect(
      validateStep(
        'location',
        draftReducer(located, { type: 'setAddress', address: 'a'.repeat(301) }),
      ),
    ).toEqual({ address: 'reportFlow.errors.addressTooLong' });
    expect(
      validateStep(
        'location',
        reduce({ type: 'setLocation', location: { latitude: 91, longitude: 0 } }),
      ).location,
    ).toBe('reportFlow.errors.locationRequired');
  });

  it('photos are optional; oversized ones are invalid', () => {
    expect(validateStep('photos', EMPTY_DRAFT)).toEqual({});
    const big = reduce({ type: 'addPhoto', photo: { ...photo(1), sizeBytes: 11 * 1024 * 1024 } });
    expect(validateStep('photos', big)).toEqual({ photos: 'reportFlow.errors.photoInvalid' });
  });

  it('points to the first incomplete step', () => {
    expect(firstInvalidStep(EMPTY_DRAFT)).toBe('category');
    expect(firstInvalidStep(complete)).toBeNull();
  });

  it('only uses message keys that exist in the translations', () => {
    for (const draft of [EMPTY_DRAFT, complete]) {
      for (const step of REPORT_STEPS) {
        for (const key of Object.values(validateStep(step, draft))) {
          expect(typeof lookup(key)).toBe('string');
        }
      }
    }
  });
});

describe('toSubmitReportInput', () => {
  it('maps the draft to the API input (trimmed, defaults left to the database)', () => {
    expect(toSubmitReportInput(complete)).toEqual({
      municipalityId,
      category: 'pothole',
      description: 'Deep pothole in the right lane',
      location: { latitude: 32.0853, longitude: 34.7818, accuracy: 8 },
      address: 'Herzl St 24',
    });
  });

  it('includes an explicit visibility and omits an empty address', () => {
    const draft = reduce(
      { type: 'restore', draft: complete },
      { type: 'setAddress', address: '   ' },
      { type: 'setVisibility', visibility: 'private' },
    );
    const input = toSubmitReportInput(draft);
    expect(input.visibility).toBe('private');
    expect(input).not.toHaveProperty('address');
  });

  it('works for every shared category and refuses an incomplete draft', () => {
    for (const category of REPORT_CATEGORIES) {
      expect(toSubmitReportInput({ ...complete, category }).category).toBe(category);
    }
    expect(() => toSubmitReportInput(EMPTY_DRAFT)).toThrow();
  });
});

describe('persistence', () => {
  it('round-trips a draft, including a sent report and photo progress', () => {
    const sent = reduce(
      { type: 'restore', draft: complete },
      { type: 'submitted', submission },
      { type: 'photoUploaded', id: photo(1).id },
    );
    expect(parseStoredDraft(serializeDraft(sent))).toEqual(sent);
  });

  it('ignores missing, corrupt or incompatible data', () => {
    expect(parseStoredDraft(null)).toBeNull();
    expect(parseStoredDraft('not json')).toBeNull();
    expect(parseStoredDraft(JSON.stringify({ version: 999, draft: complete }))).toBeNull();
    expect(
      parseStoredDraft(
        JSON.stringify({ version: 1, draft: { ...complete, category: 'graffiti' } }),
      ),
    ).toBeNull();
  });

  it('stores drafts per user', () => {
    expect(draftStorageKey('user-1')).not.toBe(draftStorageKey('user-2'));
  });
});
