import {
  ALLOWED_REPORT_PHOTO_TYPES,
  createReportSchema,
  MAX_REPORT_PHOTO_BYTES,
} from '@smart-city/shared';
import { z } from 'zod';

import type { SmartCityClient } from '../client';
import { ApiError, type ApiErrorCode } from '../errors/api-error';
import { toApiError } from '../errors/to-api-error';
import { runListQuery } from '../utils/query';
import { requireUserId } from '../utils/session';
import { parseInput } from '../utils/validation';

/*
 * Citizen report submission: the report (`submit_report`), its photos in the private
 * `report-media` bucket, and their registration (`add_report_attachment`). Every rule is
 * enforced by the database and storage policies; validation here only fails early.
 *
 * Retry safety, which callers rely on:
 * - submitReport creates a new report on every successful call. Call it once, keep the result,
 *   and only retry the photo steps afterwards.
 * - Each local photo gets one id (newReportPhotoId) that fixes its storage path, so a retried
 *   upload targets the same object: "already exists" counts as uploaded, never a second file.
 * - Registering an already-registered path counts as registered (storage_path is unique).
 */

export const REPORT_MEDIA_BUCKET = 'report-media';

// ---------------------------------------------------------------------------------------------
// submitReport
// ---------------------------------------------------------------------------------------------

/** The shared create-report rules (the RPC detects the neighborhood itself). */
const submitReportSchema = createReportSchema.omit({ neighborhoodId: true });
export type SubmitReportInput = z.input<typeof submitReportSchema>;

export interface SubmittedReport {
  reportId: string;
  trackingNumber: string;
}

/**
 * Submits a report as the signed-in citizen (`submit_report`). Not idempotent: each successful
 * call creates a report, so never repeat it to retry photos.
 */
export async function submitReport(
  client: SmartCityClient,
  input: SubmitReportInput,
): Promise<SubmittedReport> {
  const report = parseInput(submitReportSchema, input);
  await requireUserId(client);

  const rows = await runListQuery(
    client.rpc('submit_report', {
      p_municipality_id: report.municipalityId,
      p_category_code: report.category,
      p_description: report.description,
      p_latitude: report.location.latitude,
      p_longitude: report.location.longitude,
      p_location_accuracy_m: report.location.accuracy,
      p_address: report.address,
      p_visibility: report.visibility,
    }),
  );
  const [row] = rows;
  if (!row) {
    throw new ApiError('server', { debug: { message: 'submit_report returned no row' } });
  }
  return { reportId: row.report_id, trackingNumber: row.tracking_number };
}

// ---------------------------------------------------------------------------------------------
// Photo paths
// ---------------------------------------------------------------------------------------------

export type ReportPhotoMimeType = (typeof ALLOWED_REPORT_PHOTO_TYPES)[number];

const EXTENSIONS: Readonly<Record<ReportPhotoMimeType, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/webp': 'webp',
};

/**
 * A new random photo id (UUID v4 from the platform's cryptographically secure generator).
 * Generate it once per local photo and keep it with the draft: it fixes the storage path.
 */
export function newReportPhotoId(): string {
  const crypto = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } })
    .crypto;
  if (typeof crypto?.getRandomValues !== 'function') {
    throw new ApiError('server', { debug: { message: 'No secure random source for photo ids' } });
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const photoPathSchema = z.object({
  municipalityId: z.uuid(),
  reportId: z.uuid(),
  photoId: z.uuid(),
  mimeType: z.enum(ALLOWED_REPORT_PHOTO_TYPES),
});
export type ReportPhotoPathInput = z.input<typeof photoPathSchema>;

/**
 * The storage path the policies and `add_report_attachment` accept:
 * `{municipality_id}/{report_id}/citizen/{photo_id}.{ext}` (lowercase).
 */
export function buildReportPhotoPath(input: ReportPhotoPathInput): string {
  const { municipalityId, reportId, photoId, mimeType } = parseInput(photoPathSchema, input);
  return [
    municipalityId.toLowerCase(),
    reportId.toLowerCase(),
    'citizen',
    `${photoId.toLowerCase()}.${EXTENSIONS[mimeType]}`,
  ].join('/');
}

// ---------------------------------------------------------------------------------------------
// uploadReportPhoto
// ---------------------------------------------------------------------------------------------

export type ReportPhotoBytes = ArrayBuffer | Uint8Array | Blob;

export interface UploadReportPhotoInput extends ReportPhotoPathInput {
  bytes: ReportPhotoBytes;
}

export interface UploadedReportPhoto {
  storagePath: string;
  /** The object was already stored by an earlier attempt (a retry), nothing was re-uploaded. */
  alreadyUploaded: boolean;
}

function byteSize(bytes: ReportPhotoBytes): number {
  return bytes instanceof ArrayBuffer
    ? bytes.byteLength
    : 'size' in bytes
      ? bytes.size
      : bytes.byteLength;
}

interface StorageErrorLike {
  message?: string;
  status?: number;
  statusCode?: string;
  originalError?: unknown;
}

/**
 * The status that describes the failure. storage-js puts the HTTP status in `status` and the
 * body's `statusCode` in `statusCode`. Storage has answered in two formats over time, e.g. for
 * an existing object: HTTP 409 with `statusCode: "409"`, or HTTP 400 with `statusCode: "409"`
 * (likewise 403 for a refused policy). A numeric body `statusCode` is therefore the real reason;
 * non-numeric codes (e.g. "InvalidKey") fall back to the HTTP status.
 */
export function storageErrorStatus(error: StorageErrorLike): number | undefined {
  const body = typeof error.statusCode === 'string' ? error.statusCode.trim() : '';
  if (/^[1-5]\d\d$/.test(body)) return Number(body);
  return typeof error.status === 'number' && error.status > 0 ? error.status : undefined;
}

/** Maps a storage-js error to an ApiError (see storageErrorStatus for the two formats). */
function fromStorageError(error: StorageErrorLike): ApiError {
  const status = storageErrorStatus(error);
  if (!status) {
    // No HTTP response: a failed connection (StorageUnknownError wraps the fetch failure).
    return error.originalError !== undefined
      ? toApiError(error.originalError)
      : new ApiError('network', { debug: { message: error.message } });
  }
  const code: ApiErrorCode =
    status === 401
      ? 'unauthorized'
      : status === 403
        ? 'forbidden'
        : status === 404
          ? 'not_found'
          : status === 409
            ? 'conflict'
            : status === 429
              ? 'rate_limited'
              : status === 400 || status === 413 || status === 415 || status === 422
                ? 'validation'
                : 'server';
  return new ApiError(code, { debug: { message: error.message, status } });
}

/**
 * Uploads one photo to the private bucket at its fixed path (never overwriting: `upsert` is
 * false and the API has no update rights). If the object already exists — an earlier attempt
 * succeeded — this reports `alreadyUploaded` instead of failing.
 */
export async function uploadReportPhoto(
  client: SmartCityClient,
  input: UploadReportPhotoInput,
): Promise<UploadedReportPhoto> {
  const storagePath = buildReportPhotoPath(input);
  const size = byteSize(input.bytes);
  if (size < 1 || size > MAX_REPORT_PHOTO_BYTES) {
    throw new ApiError('validation', {
      issues: [{ path: 'bytes', message: 'The photo must be between 1 byte and 10 MB' }],
    });
  }
  await requireUserId(client);

  let response: { error: StorageErrorLike | null };
  try {
    response = await client.storage.from(REPORT_MEDIA_BUCKET).upload(storagePath, input.bytes, {
      contentType: input.mimeType,
      upsert: false,
    });
  } catch (error) {
    throw toApiError(error);
  }
  if (!response.error) return { storagePath, alreadyUploaded: false };

  const failure = fromStorageError(response.error);
  if (failure.code === 'conflict') return { storagePath, alreadyUploaded: true };
  throw failure;
}

// ---------------------------------------------------------------------------------------------
// addReportAttachment
// ---------------------------------------------------------------------------------------------

const attachmentSchema = z.object({
  reportId: z.uuid(),
  storagePath: z.string().min(1).max(300),
});
export type AddReportAttachmentInput = z.input<typeof attachmentSchema>;

export interface RegisteredReportPhoto {
  attachmentId: string;
  /** The path was registered by an earlier attempt (a retry); no second row was created. */
  alreadyRegistered: boolean;
}

/**
 * Registers an uploaded photo on the caller's report (`add_report_attachment`). The database
 * re-checks ownership, the report status, the 5-photo limit, the path, and the stored file's
 * real size and type. A path that is already registered counts as registered.
 */
export async function addReportAttachment(
  client: SmartCityClient,
  input: AddReportAttachmentInput,
): Promise<RegisteredReportPhoto> {
  const { reportId, storagePath } = parseInput(attachmentSchema, input);
  await requireUserId(client);

  try {
    const [id] = await runListQuery(
      client
        .rpc('add_report_attachment', { p_report_id: reportId, p_storage_path: storagePath })
        .then((response) => ({ ...response, data: response.data ? [response.data] : null })),
    );
    if (!id) throw new ApiError('server', { debug: { message: 'No attachment id returned' } });
    return { attachmentId: id, alreadyRegistered: false };
  } catch (error) {
    if (!(error instanceof ApiError && error.code === 'conflict')) throw error;
  }

  // storage_path is unique: find the existing registration (own reports only).
  const existing = await runListQuery(
    client.rpc('get_my_report_attachments', { p_report_id: reportId }),
  );
  const match = existing.find((row) => row.storage_path === storagePath);
  if (!match) throw new ApiError('conflict');
  return { attachmentId: match.id, alreadyRegistered: true };
}

// ---------------------------------------------------------------------------------------------
// attachReportPhoto: upload + register, safe to repeat
// ---------------------------------------------------------------------------------------------

export interface AttachReportPhotoInput extends ReportPhotoPathInput {
  /** The photo's data. Not needed when `uploaded` is set. */
  bytes?: ReportPhotoBytes;
  /** Set when an earlier attempt already uploaded the file: skips straight to registration. */
  uploaded?: boolean;
  /**
   * Called (and awaited) once the file is stored, before registration, so the caller can
   * persist that fact: a retry after a failed registration then passes `uploaded` and sends
   * no bytes again.
   */
  onUploaded?: () => void | Promise<void>;
}

export interface AttachedReportPhoto {
  storagePath: string;
  attachmentId: string;
}

/**
 * Uploads (unless already uploaded) and registers one photo. Safe to call again after any
 * failure with the same `photoId`: it never creates a second file or a second registration.
 *
 * If the upload is refused but an earlier attempt may have stored the file (e.g. the 5-object
 * check now counts it), registration is tried anyway: the database confirms the file exists.
 */
export async function attachReportPhoto(
  client: SmartCityClient,
  input: AttachReportPhotoInput,
): Promise<AttachedReportPhoto> {
  const storagePath = buildReportPhotoPath(input);

  if (!input.uploaded) {
    if (!input.bytes) {
      throw new ApiError('validation', {
        issues: [{ path: 'bytes', message: 'The photo data is required until it is uploaded' }],
      });
    }
    try {
      await uploadReportPhoto(client, { ...input, bytes: input.bytes });
    } catch (uploadError) {
      if (!(uploadError instanceof ApiError && uploadError.code === 'forbidden')) throw uploadError;
      try {
        const registered = await addReportAttachment(client, {
          reportId: input.reportId,
          storagePath,
        });
        return { storagePath, attachmentId: registered.attachmentId };
      } catch {
        throw uploadError;
      }
    }
    await input.onUploaded?.();
  }

  const registered = await addReportAttachment(client, { reportId: input.reportId, storagePath });
  return { storagePath, attachmentId: registered.attachmentId };
}

// ---------------------------------------------------------------------------------------------
// Specific reasons for the UI
// ---------------------------------------------------------------------------------------------

/**
 * The exact messages raised by `submit_report` / `add_report_attachment`. ApiError keeps them in
 * `debug` only; this list turns them into reasons the UI can explain. A database test asserts
 * the RPCs still raise these exact texts.
 */
export const REPORT_SUBMISSION_MESSAGES = {
  municipality_unavailable: ['Municipality not found or not active'],
  category_unavailable: [
    'Unknown report category',
    'This category is not available in this municipality',
  ],
  outside_municipality: ['The location is outside the municipality'],
  photos_closed: ['Photos can only be added while the report is newly submitted'],
  photo_limit: ['A report can have at most 5 photos'],
  photo_missing: ['The file has not been uploaded'],
  photo_invalid: ['The file is empty or larger than 10 MB', 'Unsupported file type'],
} as const;

export type ReportSubmissionIssue = keyof typeof REPORT_SUBMISSION_MESSAGES | 'rate_limited';

/** A specific, explainable reason for a failed submission or photo step, or null. */
export function reportSubmissionIssue(error: unknown): ReportSubmissionIssue | null {
  if (!(error instanceof ApiError)) return null;
  if (error.code === 'rate_limited') return 'rate_limited';
  const message = error.debug.message ?? '';
  for (const [issue, messages] of Object.entries(REPORT_SUBMISSION_MESSAGES)) {
    if ((messages as readonly string[]).includes(message)) return issue as ReportSubmissionIssue;
  }
  return null;
}
