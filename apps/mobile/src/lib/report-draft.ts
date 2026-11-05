/**
 * Report submission draft: state, per-step validation, persistence format and the payload for
 * `submitReport`. Pure (no React Native imports) so it can be unit-tested. Validation reuses the
 * shared schemas, which mirror the database rules of `submit_report`.
 */
import type { SubmitReportInput } from '@smart-city/api';
import {
  coordinatesSchema,
  createReportSchema,
  defaultReportVisibility,
  MAX_REPORT_PHOTO_BYTES,
  MAX_REPORT_PHOTOS,
  REPORT_CATEGORIES,
  REPORT_VISIBILITIES,
  type ReportCategory,
  type ReportVisibility,
} from '@smart-city/shared';
import type { MessageKey } from '@smart-city/shared/i18n';
import { z } from 'zod';

import type { KeyValueStore } from './password-recovery-state';

export const REPORT_STEPS = ['category', 'details', 'location', 'photos', 'review'] as const;
export type ReportStep = (typeof REPORT_STEPS)[number];

/** Mirrors `createReportSchema.description` (trimmed 10–2000 characters). */
export const DESCRIPTION_MIN_LENGTH = 10;
export const DESCRIPTION_MAX_LENGTH = 2000;
/** Mirrors `createReportSchema.address`. */
export const ADDRESS_MAX_LENGTH = 300;

export interface DraftLocation {
  latitude: number;
  longitude: number;
  /** Horizontal accuracy in meters, as reported by the device. */
  accuracy?: number;
}

/** A photo prepared on the device (JPEG, resized, metadata removed) and its upload progress. */
export interface DraftPhoto {
  /** Fixed for this photo's lifetime: it determines the storage path, so retries never duplicate. */
  id: string;
  /** The prepared JPEG on the device. */
  uri: string;
  mimeType: 'image/jpeg';
  sizeBytes: number;
  width: number;
  height: number;
  /** The file is stored in the bucket (a retry only needs to register it). */
  uploaded: boolean;
  /** The photo is attached to the report. */
  registered: boolean;
  /** Why the last attempt failed, if it did. */
  error: MessageKey | null;
  /** Whether trying again can help (false e.g. when the municipality already started work). */
  retryable: boolean;
}

/** Set once `submitReport` succeeded: from then on the report exists and is never re-sent. */
export interface DraftSubmission {
  reportId: string;
  trackingNumber: string;
  municipalityId: string;
}

export interface ReportDraft {
  municipalityId: string | null;
  category: ReportCategory | null;
  description: string;
  location: DraftLocation | null;
  /** Optional, typed by the citizen (no reverse geocoding). */
  address: string;
  photos: DraftPhoto[];
  /** `null` = the category default (sensitive categories default to private). */
  visibility: ReportVisibility | null;
  submission: DraftSubmission | null;
}

export const EMPTY_DRAFT: ReportDraft = {
  municipalityId: null,
  category: null,
  description: '',
  location: null,
  address: '',
  photos: [],
  visibility: null,
  submission: null,
};

export type NewDraftPhoto = Pick<DraftPhoto, 'id' | 'uri' | 'sizeBytes' | 'width' | 'height'>;

export type DraftAction =
  | { type: 'setMunicipality'; municipalityId: string | null }
  | { type: 'setCategory'; category: ReportCategory | null }
  | { type: 'setDescription'; description: string }
  | { type: 'setLocation'; location: DraftLocation | null }
  | { type: 'setAddress'; address: string }
  | { type: 'addPhoto'; photo: NewDraftPhoto }
  | { type: 'removePhoto'; id: string }
  | { type: 'setVisibility'; visibility: ReportVisibility }
  | { type: 'submitted'; submission: DraftSubmission }
  | { type: 'photoUploaded'; id: string }
  | { type: 'photoRegistered'; id: string }
  | { type: 'photoFailed'; id: string; error: MessageKey; retryable: boolean }
  | { type: 'restore'; draft: ReportDraft }
  | { type: 'reset' };

const updatePhoto = (draft: ReportDraft, id: string, change: Partial<DraftPhoto>): ReportDraft => ({
  ...draft,
  photos: draft.photos.map((photo) => (photo.id === id ? { ...photo, ...change } : photo)),
});

export function draftReducer(draft: ReportDraft, action: DraftAction): ReportDraft {
  // Once sent, the report's content is fixed: only photo progress, removing photos that were
  // never attached, and finishing/clearing are allowed.
  const locked = draft.submission !== null;
  switch (action.type) {
    case 'setMunicipality':
      if (locked || action.municipalityId === draft.municipalityId) return draft;
      // Categories differ per municipality: choose again. A category picked before any
      // municipality (a shortcut) is kept; the category step drops it if it isn't offered.
      return {
        ...draft,
        municipalityId: action.municipalityId,
        category: draft.municipalityId === null ? draft.category : null,
      };
    case 'setCategory':
      return locked ? draft : { ...draft, category: action.category };
    case 'setDescription':
      return locked ? draft : { ...draft, description: action.description };
    case 'setLocation':
      return locked ? draft : { ...draft, location: action.location };
    case 'setAddress':
      return locked ? draft : { ...draft, address: action.address };
    case 'addPhoto':
      if (locked || draft.photos.length >= MAX_REPORT_PHOTOS) return draft;
      if (draft.photos.some((photo) => photo.id === action.photo.id)) return draft;
      return {
        ...draft,
        photos: [
          ...draft.photos,
          {
            ...action.photo,
            mimeType: 'image/jpeg',
            uploaded: false,
            registered: false,
            error: null,
            retryable: true,
          },
        ],
      };
    case 'removePhoto': {
      const photo = draft.photos.find((item) => item.id === action.id);
      if (!photo || photo.registered || (locked && photo.uploaded)) return draft;
      return { ...draft, photos: draft.photos.filter((item) => item.id !== action.id) };
    }
    case 'setVisibility':
      return locked ? draft : { ...draft, visibility: action.visibility };
    case 'submitted':
      return locked ? draft : { ...draft, submission: action.submission };
    case 'photoUploaded':
      return updatePhoto(draft, action.id, { uploaded: true });
    case 'photoRegistered':
      return updatePhoto(draft, action.id, {
        uploaded: true,
        registered: true,
        error: null,
        retryable: true,
      });
    case 'photoFailed':
      return updatePhoto(draft, action.id, { error: action.error, retryable: action.retryable });
    case 'restore':
      return action.draft;
    case 'reset':
      return EMPTY_DRAFT;
  }
}

const KB = 1024;
const MB = 1024 * KB;

/**
 * File size for display: "850 B", "19 KB", "1.2 MB". Never "0.0 MB" for a small photo.
 * (Latin units and digits, shown left-to-right in every language.)
 */
export function formatFileSize(bytes: number): string {
  if (!(bytes > 0)) return '0 B';
  if (bytes < KB) return `${Math.round(bytes)} B`;
  // KB (rounded up, so never "0 KB") until it would read 1000 KB; then MB with one decimal.
  if (bytes < 1000 * KB) return `${Math.ceil(bytes / KB)} KB`;
  return `${Math.max(1, bytes / MB).toFixed(1)} MB`;
}

/** The visibility the report will get: the citizen's choice, else the category default. */
export function effectiveVisibility(draft: ReportDraft): ReportVisibility {
  if (draft.visibility) return draft.visibility;
  return draft.category ? defaultReportVisibility(draft.category) : 'public';
}

/** Whether the user has entered anything worth keeping. */
export function isDraftStarted(draft: ReportDraft): boolean {
  return (
    draft.submission !== null ||
    draft.category !== null ||
    draft.description.trim() !== '' ||
    draft.location !== null ||
    draft.photos.length > 0
  );
}

export type DraftField =
  'municipality' | 'category' | 'description' | 'location' | 'address' | 'photos';
export type DraftErrors = Partial<Record<DraftField, MessageKey>>;

function validateCategory(draft: ReportDraft): DraftErrors {
  if (!draft.municipalityId) return { municipality: 'reportFlow.chooseMunicipality' };
  return draft.category ? {} : { category: 'reportFlow.errors.categoryRequired' };
}

function validateDescription(draft: ReportDraft): DraftErrors {
  const result = createReportSchema.shape.description.safeParse(draft.description);
  if (result.success) return {};
  return {
    description:
      result.error.issues[0]?.code === 'too_big'
        ? 'reportFlow.errors.descriptionTooLong'
        : 'reportFlow.errors.descriptionTooShort',
  };
}

function validateLocation(draft: ReportDraft): DraftErrors {
  const errors: DraftErrors = {};
  if (!draft.location || !coordinatesSchema.safeParse(draft.location).success) {
    errors.location = 'reportFlow.errors.locationRequired';
  }
  if (draft.address.trim().length > ADDRESS_MAX_LENGTH) {
    errors.address = 'reportFlow.errors.addressTooLong';
  }
  return errors;
}

function validatePhotos(draft: ReportDraft): DraftErrors {
  if (draft.photos.length > MAX_REPORT_PHOTOS) return { photos: 'reportFlow.errors.photoLimit' };
  const invalid = draft.photos.some(
    (photo) => photo.sizeBytes < 1 || photo.sizeBytes > MAX_REPORT_PHOTO_BYTES,
  );
  return invalid ? { photos: 'reportFlow.errors.photoInvalid' } : {};
}

const STEP_VALIDATORS: Record<
  Exclude<ReportStep, 'review'>,
  (draft: ReportDraft) => DraftErrors
> = {
  category: validateCategory,
  details: validateDescription,
  location: validateLocation,
  photos: validatePhotos,
};

/** Errors of one step; the review step checks everything. */
export function validateStep(step: ReportStep, draft: ReportDraft): DraftErrors {
  if (step !== 'review') return STEP_VALIDATORS[step](draft);
  return Object.assign(
    {},
    ...Object.values(STEP_VALIDATORS).map((validate) => validate(draft)),
  ) as DraftErrors;
}

/** The first step that still has errors, or `null` when the draft is ready to submit. */
export function firstInvalidStep(draft: ReportDraft): ReportStep | null {
  for (const step of REPORT_STEPS) {
    if (step !== 'review' && Object.keys(validateStep(step, draft)).length > 0) return step;
  }
  return null;
}

/** The `submitReport` input. Call only when `firstInvalidStep(draft)` is null. */
export function toSubmitReportInput(draft: ReportDraft): SubmitReportInput {
  if (!draft.municipalityId || !draft.category || !draft.location) {
    throw new Error('The draft is incomplete');
  }
  const address = draft.address.trim();
  return {
    municipalityId: draft.municipalityId,
    category: draft.category,
    description: draft.description.trim(),
    location: {
      latitude: draft.location.latitude,
      longitude: draft.location.longitude,
      ...(draft.location.accuracy !== undefined ? { accuracy: draft.location.accuracy } : {}),
    },
    ...(address ? { address } : {}),
    // null = the database applies the category default (sensitive categories are private).
    ...(draft.visibility ? { visibility: draft.visibility } : {}),
  };
}

export interface PhotoProgress {
  total: number;
  registered: number;
  failed: number;
}

export function photoProgress(draft: ReportDraft): PhotoProgress {
  return {
    total: draft.photos.length,
    registered: draft.photos.filter((photo) => photo.registered).length,
    failed: draft.photos.filter((photo) => !photo.registered && photo.error !== null).length,
  };
}

// ---------------------------------------------------------------------------------------------
// Persistence: the draft is stored on the device so it survives restarts (including a report
// that was sent but whose photos are not all attached yet).
// ---------------------------------------------------------------------------------------------

export const DRAFT_STORAGE_VERSION = 1;

export function draftStorageKey(owner: string): string {
  return `smart-city.report-draft.v${DRAFT_STORAGE_VERSION}.${owner}`;
}

const storedPhotoSchema = z.object({
  id: z.uuid(),
  uri: z.string().min(1),
  mimeType: z.literal('image/jpeg'),
  sizeBytes: z.number().int().nonnegative(),
  width: z.number().nonnegative(),
  height: z.number().nonnegative(),
  uploaded: z.boolean(),
  registered: z.boolean(),
  error: z.string().nullable(),
  retryable: z.boolean(),
});

const storedDraftSchema = z.object({
  version: z.literal(DRAFT_STORAGE_VERSION),
  draft: z.object({
    municipalityId: z.uuid().nullable(),
    category: z.enum(REPORT_CATEGORIES).nullable(),
    description: z.string(),
    location: coordinatesSchema.nullable(),
    address: z.string(),
    photos: z.array(storedPhotoSchema).max(MAX_REPORT_PHOTOS),
    visibility: z.enum(REPORT_VISIBILITIES).nullable(),
    submission: z
      .object({ reportId: z.uuid(), trackingNumber: z.string(), municipalityId: z.uuid() })
      .nullable(),
  }),
});

export function serializeDraft(draft: ReportDraft): string {
  return JSON.stringify({ version: DRAFT_STORAGE_VERSION, draft });
}

/** The stored draft, or null if missing, from another version, or corrupt. */
export function parseStoredDraft(value: string | null): ReportDraft | null {
  if (!value) return null;
  try {
    const parsed = storedDraftSchema.safeParse(JSON.parse(value));
    return parsed.success ? (parsed.data.draft as ReportDraft) : null;
  } catch {
    return null;
  }
}

/** The owner's saved draft, or null (nothing saved, unreadable, or storage unavailable). */
export async function loadStoredDraft(
  store: KeyValueStore,
  owner: string,
): Promise<ReportDraft | null> {
  try {
    return parseStoredDraft(await store.getItem(draftStorageKey(owner)));
  } catch {
    return null;
  }
}

/** Saves the draft; an empty draft removes the saved one. Errors propagate to the caller. */
export async function saveStoredDraft(
  store: KeyValueStore,
  owner: string,
  draft: ReportDraft,
): Promise<void> {
  const key = draftStorageKey(owner);
  if (isDraftStarted(draft)) await store.setItem(key, serializeDraft(draft));
  else await store.removeItem(key);
}
