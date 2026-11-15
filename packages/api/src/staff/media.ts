import { ALLOWED_REPORT_PHOTO_TYPES, MAX_REPORT_PHOTO_BYTES } from '@smart-city/shared';
import { z } from 'zod';

import type { SmartCityClient } from '../client';
import { ApiError } from '../errors/api-error';
import { toApiError } from '../errors/to-api-error';
import { REPORT_MEDIA_BUCKET, type ReportPhotoMimeType } from '../reports/submission';
import { runMaybeSingleQuery } from '../utils/query';
import { requireUserId } from '../utils/session';
import { parseInput } from '../utils/validation';
import type { StaffReportAttachment } from './reports';

/*
 * Report photos for staff: short-lived signed URLs for viewing, and completion photos uploaded
 * by the handling staff member.
 *
 * The report-media bucket is private. Signed URLs are created as the signed-in staff member, so
 * the storage policy (private.can_read_report_media → can_access_report) decides; they expire
 * quickly and must never be cached across requests or users.
 *
 * Completion photos go straight from the browser to storage as the signed-in user (never
 * through the app server), at {municipality_id}/{report_id}/completion/{uuid}.{ext}. The upload
 * policy allows only staff handling the report while it is in progress or resolved, at most
 * five; `add_report_attachment` then re-checks everything, including the stored file's real
 * size and type, and records it.
 */

/** Signed URLs live this long. Long enough to view a page, short enough not to be shared. */
export const REPORT_MEDIA_URL_TTL_SECONDS = 300;

/** Upper bound for completion photos on one report (enforced by storage and the RPC). */
export const MAX_COMPLETION_PHOTOS = 5;

export interface SignedReportMedia {
  attachmentId: string;
  /** A short-lived URL for displaying the image; null if signing failed for this file. */
  viewUrl: string | null;
  /** The same file served as a download (used for HEIC, which most browsers can't display). */
  downloadUrl: string | null;
  /** Whether browsers can generally display this type inline. */
  displayable: boolean;
}

const INLINE_TYPES: ReadonlySet<string> = new Set(['image/jpeg', 'image/png', 'image/webp']);

interface SignedUrlRow {
  path: string | null;
  signedUrl: string | null;
  error: string | null;
}

async function signPaths(
  client: SmartCityClient,
  paths: string[],
  options: { download?: boolean },
): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map();
  let response: { data: SignedUrlRow[] | null; error: { message?: string } | null };
  try {
    response = (await client.storage
      .from(REPORT_MEDIA_BUCKET)
      .createSignedUrls(paths, REPORT_MEDIA_URL_TTL_SECONDS, options)) as typeof response;
  } catch (error) {
    throw toApiError(error);
  }
  if (response.error) {
    throw new ApiError('server', { debug: { message: response.error.message } });
  }
  const urls = new Map<string, string>();
  for (const row of response.data ?? []) {
    if (row.path && row.signedUrl && !row.error) urls.set(row.path, row.signedUrl);
  }
  return urls;
}

/**
 * Short-lived signed URLs for a report's attachments, as the signed-in staff member. A file the
 * caller may not read (or that is missing from storage) gets null URLs rather than failing the
 * whole page. Create these per request; never cache them.
 */
export async function signReportAttachments(
  client: SmartCityClient,
  attachments: readonly Pick<StaffReportAttachment, 'id' | 'storage_path' | 'mime_type'>[],
): Promise<SignedReportMedia[]> {
  if (attachments.length === 0) return [];
  await requireUserId(client);
  const paths = attachments.map((attachment) => attachment.storage_path);
  const [view, download] = await Promise.all([
    signPaths(client, paths, {}),
    signPaths(client, paths, { download: true }),
  ]);
  return attachments.map((attachment) => ({
    attachmentId: attachment.id,
    viewUrl: view.get(attachment.storage_path) ?? null,
    downloadUrl: download.get(attachment.storage_path) ?? null,
    displayable: INLINE_TYPES.has(attachment.mime_type),
  }));
}

// ---------------------------------------------------------------------------------------------
// Completion photos
// ---------------------------------------------------------------------------------------------

const EXTENSIONS: Readonly<Record<ReportPhotoMimeType, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/webp': 'webp',
};

const completionPathSchema = z.strictObject({
  municipalityId: z.uuid(),
  reportId: z.uuid(),
  photoId: z.uuid(),
  mimeType: z.enum(ALLOWED_REPORT_PHOTO_TYPES),
});
export type CompletionPhotoPathInput = z.input<typeof completionPathSchema>;

/**
 * The storage path the policies and `add_report_attachment` accept for a completion photo:
 * `{municipality_id}/{report_id}/completion/{photo_id}.{ext}` (lowercase).
 */
export function buildCompletionPhotoPath(input: CompletionPhotoPathInput): string {
  const { municipalityId, reportId, photoId, mimeType } = parseInput(completionPathSchema, input);
  return [
    municipalityId.toLowerCase(),
    reportId.toLowerCase(),
    'completion',
    `${photoId.toLowerCase()}.${EXTENSIONS[mimeType]}`,
  ].join('/');
}

export type CompletionPhotoProblem = 'type' | 'size';

/**
 * Checks a file before uploading: one of the accepted image types and 1 byte – 10 MB. Returns
 * the problem, or null. Storage and the RPC check again with the stored file's real metadata.
 */
export function completionPhotoProblem(file: {
  type: string;
  size: number;
}): CompletionPhotoProblem | null {
  if (!(ALLOWED_REPORT_PHOTO_TYPES as readonly string[]).includes(file.type)) return 'type';
  if (file.size < 1 || file.size > MAX_REPORT_PHOTO_BYTES) return 'size';
  return null;
}

const registerSchema = z.strictObject({
  reportId: z.uuid(),
  storagePath: z.string().min(1).max(300),
});

/**
 * Registers an uploaded completion photo (`add_report_attachment`, kind `completion_photo`).
 * The database checks that the caller handles the report, its status, the five-photo limit,
 * the path, and the stored file's real size and type. Returns the attachment id.
 */
export async function registerCompletionPhoto(
  client: SmartCityClient,
  input: z.input<typeof registerSchema>,
): Promise<string> {
  const { reportId, storagePath } = parseInput(registerSchema, input);
  if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/completion\//.test(storagePath)) {
    throw new ApiError('validation', {
      issues: [{ path: 'storagePath', message: 'Not a completion photo path' }],
    });
  }
  await requireUserId(client);
  const id = await runMaybeSingleQuery(
    client.rpc('add_report_attachment', {
      p_report_id: reportId,
      p_storage_path: storagePath,
      p_kind: 'completion_photo',
    }),
  );
  if (typeof id !== 'string') {
    throw new ApiError('server', { debug: { message: 'add_report_attachment returned no id' } });
  }
  return id;
}
