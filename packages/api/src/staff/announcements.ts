import {
  ANNOUNCEMENT_IMAGE_TYPES,
  announcementSchema,
  announcementUpdateSchema,
  type AnnouncementImageType,
  type AnnouncementInput,
  type AnnouncementUpdateInput,
  type LocalizedText,
} from '@smart-city/shared';
import { z } from 'zod';

import type { SmartCityClient } from '../client';
import type { Enums } from '../database.types';
import { ApiError } from '../errors/api-error';
import { toApiError } from '../errors/to-api-error';
import { ANNOUNCEMENT_COLUMNS } from '../reference-data/columns';
import { PUBLIC_CONTENT_BUCKET } from '../reference-data/reference-data';
import { fromStorageError, storageErrorStatus } from '../reports/submission';
import { runListQuery, runMaybeSingleQuery, runMutation } from '../utils/query';
import { requireUserId } from '../utils/session';
import { parseInput, toLocalizedText } from '../utils/validation';

/*
 * Announcements as staff see them (drafts, published and archived). All writes run as the
 * signed-in user:
 *   - insert: RLS "Staff create drafts for their department" (can_draft_content) — admins any
 *     department or municipality-wide, employees/managers their own department; always a draft;
 *   - update: the draft's author, or a publisher (RLS); edits of published ones are audited;
 *   - publish / archive: set_announcement_status() (can_publish_content), audited;
 *   - delete: drafts only, by their author or a publisher (RLS).
 * Every statement is scoped to the municipality, so a foreign id matches nothing.
 *
 * Images: uploaded to the private `content-drafts` bucket at
 * {municipality_id}/announcements/{announcement_id}/{uuid}.{ext} by whoever may edit the
 * announcement; once it is published, a publisher copies exactly its `image_path` to the public
 * `public-content` bucket (the only way anything becomes public).
 */

/** Never includes created_by / published_by, which no API role can read. */
export const STAFF_ANNOUNCEMENT_COLUMNS = `${ANNOUNCEMENT_COLUMNS}, status` as const;

/** Private bucket for announcement images before (and while) they are published. */
export const CONTENT_DRAFTS_BUCKET = 'content-drafts';

export interface StaffAnnouncement {
  id: string;
  municipality_id: string;
  department_id: string | null;
  neighborhood_id: string | null;
  title: LocalizedText;
  body: LocalizedText;
  severity: Enums<'announcement_severity'>;
  status: Enums<'content_status'>;
  image_path: string | null;
  expires_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

type AnnouncementRow = Omit<StaffAnnouncement, 'title' | 'body'> & {
  title: unknown;
  body: unknown;
};

function toAnnouncement(row: AnnouncementRow): StaffAnnouncement {
  return {
    ...row,
    title: toLocalizedText(row.title as never),
    body: toLocalizedText(row.body as never),
  };
}

/** jsonb for a localized field: only the languages that were given (Hebrew always). */
function textJson(text: { he: string; ar?: string; en?: string }): LocalizedText {
  return {
    he: text.he,
    ...(text.ar ? { ar: text.ar } : {}),
    ...(text.en ? { en: text.en } : {}),
  };
}

const scope = z.strictObject({ municipalityId: z.uuid() });
const refSchema = z.strictObject({ municipalityId: z.uuid(), announcementId: z.uuid() });

const LIST_LIMIT = 200;

/** Every announcement of the municipality the caller can see, newest first. */
export async function listStaffAnnouncements(
  client: SmartCityClient,
  input: z.input<typeof scope>,
): Promise<StaffAnnouncement[]> {
  const { municipalityId } = parseInput(scope, input);
  await requireUserId(client);
  const rows = await runListQuery(
    client
      .from('announcements')
      .select(STAFF_ANNOUNCEMENT_COLUMNS)
      .eq('municipality_id', municipalityId)
      .order('created_at', { ascending: false })
      .limit(LIST_LIMIT),
  );
  return (rows as unknown as AnnouncementRow[]).map(toAnnouncement);
}

/** One announcement of the municipality, or null (missing, foreign or not visible). */
export async function getStaffAnnouncement(
  client: SmartCityClient,
  input: z.input<typeof refSchema>,
): Promise<StaffAnnouncement | null> {
  const { municipalityId, announcementId } = parseInput(refSchema, input);
  await requireUserId(client);
  const row = await runMaybeSingleQuery(
    client
      .from('announcements')
      .select(STAFF_ANNOUNCEMENT_COLUMNS)
      .eq('id', announcementId)
      .eq('municipality_id', municipalityId)
      .maybeSingle(),
  );
  return row ? toAnnouncement(row as unknown as AnnouncementRow) : null;
}

const createSchema = z.strictObject({ municipalityId: z.uuid(), announcement: announcementSchema });

/** Creates a draft. Publishing is a separate step (setAnnouncementStatus). */
export async function createAnnouncement(
  client: SmartCityClient,
  input: { municipalityId: string; announcement: AnnouncementInput },
): Promise<StaffAnnouncement> {
  const { municipalityId, announcement } = parseInput(createSchema, input);
  await requireUserId(client);
  const row = await runMaybeSingleQuery(
    client
      .from('announcements')
      .insert({
        municipality_id: municipalityId,
        department_id: announcement.departmentId,
        neighborhood_id: announcement.neighborhoodId,
        title: textJson(announcement.title),
        body: textJson(announcement.body),
        severity: announcement.severity,
        expires_at: announcement.expiresAt,
      })
      .select(STAFF_ANNOUNCEMENT_COLUMNS)
      .single(),
  );
  if (!row)
    throw new ApiError('server', { debug: { message: 'Announcement insert returned no row' } });
  return toAnnouncement(row as unknown as AnnouncementRow);
}

const updateSchema = refSchema.extend({ announcement: announcementUpdateSchema });

/** Updates the text, severity, neighborhood and expiry. Not the department or the status. */
export async function updateAnnouncement(
  client: SmartCityClient,
  input: { municipalityId: string; announcementId: string; announcement: AnnouncementUpdateInput },
): Promise<StaffAnnouncement> {
  const { municipalityId, announcementId, announcement } = parseInput(updateSchema, input);
  await requireUserId(client);
  const row = await runMaybeSingleQuery(
    client
      .from('announcements')
      .update({
        neighborhood_id: announcement.neighborhoodId,
        title: textJson(announcement.title),
        body: textJson(announcement.body),
        severity: announcement.severity,
        expires_at: announcement.expiresAt,
      })
      .eq('id', announcementId)
      .eq('municipality_id', municipalityId)
      .select(STAFF_ANNOUNCEMENT_COLUMNS)
      .maybeSingle(),
  );
  // RLS reports a filtered-out update as "0 rows", not as an error.
  if (!row) throw new ApiError('forbidden');
  return toAnnouncement(row as unknown as AnnouncementRow);
}

const statusSchema = z.strictObject({
  announcementId: z.uuid(),
  status: z.enum(['published', 'archived']),
});

/** Publishes or archives (set_announcement_status: publishers only, audited). */
export async function setAnnouncementStatus(
  client: SmartCityClient,
  input: z.input<typeof statusSchema>,
): Promise<void> {
  const { announcementId, status } = parseInput(statusSchema, input);
  await requireUserId(client);
  await runMutation(
    client.rpc('set_announcement_status', {
      p_announcement_id: announcementId,
      p_status: status,
    }),
  );
}

/** Deletes a draft. Published or archived announcements are never deleted. */
export async function deleteAnnouncementDraft(
  client: SmartCityClient,
  input: z.input<typeof refSchema>,
): Promise<void> {
  const { municipalityId, announcementId } = parseInput(refSchema, input);
  await requireUserId(client);
  const row = await runMaybeSingleQuery(
    client
      .from('announcements')
      .delete()
      .eq('id', announcementId)
      .eq('municipality_id', municipalityId)
      .eq('status', 'draft')
      .select('id')
      .maybeSingle(),
  );
  if (!row) throw new ApiError('forbidden');
}

// ---------------------------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------------------------

const IMAGE_EXTENSIONS: Readonly<Record<AnnouncementImageType, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const imagePathSchema = z.strictObject({
  municipalityId: z.uuid(),
  announcementId: z.uuid(),
  imageId: z.uuid(),
  mimeType: z.enum(ANNOUNCEMENT_IMAGE_TYPES),
});

/**
 * The path the storage policies and the announcements check constraint accept:
 * `{municipality_id}/announcements/{announcement_id}/{image_id}.{ext}` (lowercase).
 */
export function buildAnnouncementImagePath(input: z.input<typeof imagePathSchema>): string {
  const { municipalityId, announcementId, imageId, mimeType } = parseInput(imagePathSchema, input);
  return [
    municipalityId.toLowerCase(),
    'announcements',
    announcementId.toLowerCase(),
    `${imageId.toLowerCase()}.${IMAGE_EXTENSIONS[mimeType]}`,
  ].join('/');
}

const IMAGE_PATH =
  /^[0-9a-f-]{36}\/announcements\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/;

function checkImagePath(path: string): string {
  if (!IMAGE_PATH.test(path)) {
    throw new ApiError('validation', {
      issues: [{ path: 'imagePath', message: 'Not an announcement image path' }],
    });
  }
  return path;
}

/** Uploads an image to the private drafts bucket (editors of the announcement only). */
export async function uploadAnnouncementImage(
  client: SmartCityClient,
  input: { path: string; file: Blob; contentType: AnnouncementImageType },
): Promise<void> {
  const path = checkImagePath(input.path);
  await requireUserId(client);
  let response;
  try {
    response = await client.storage
      .from(CONTENT_DRAFTS_BUCKET)
      .upload(path, input.file, { contentType: input.contentType, upsert: false });
  } catch (error) {
    throw toApiError(error);
  }
  if (response.error) throw fromStorageError(response.error);
}

const setImageSchema = refSchema.extend({ imagePath: z.string().nullable() });

/** Points the announcement at an uploaded image, or removes it (null). */
export async function setAnnouncementImage(
  client: SmartCityClient,
  input: z.input<typeof setImageSchema>,
): Promise<void> {
  const { municipalityId, announcementId, imagePath } = parseInput(setImageSchema, input);
  if (imagePath !== null) checkImagePath(imagePath);
  await requireUserId(client);
  const row = await runMaybeSingleQuery(
    client
      .from('announcements')
      .update({ image_path: imagePath })
      .eq('id', announcementId)
      .eq('municipality_id', municipalityId)
      .select('id')
      .maybeSingle(),
  );
  if (!row) throw new ApiError('forbidden');
}

/**
 * Makes a published announcement's image public: copies `image_path` from the drafts bucket to
 * `public-content` (the policy allows exactly that path, by a publisher, once published).
 * Already copied counts as done.
 */
export async function publishAnnouncementImage(
  client: SmartCityClient,
  input: { path: string },
): Promise<void> {
  const path = checkImagePath(input.path);
  await requireUserId(client);
  let download;
  try {
    download = await client.storage.from(CONTENT_DRAFTS_BUCKET).download(path);
  } catch (error) {
    throw toApiError(error);
  }
  if (download.error || !download.data) {
    throw download.error ? fromStorageError(download.error) : new ApiError('not_found');
  }
  // The type comes from the path (validated above), never from the download: some runtimes
  // return the body with an empty type, which the bucket's allowed-types check rejects.
  const extension = path.slice(path.lastIndexOf('.') + 1);
  const contentType =
    extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg';
  let upload;
  try {
    upload = await client.storage
      .from(PUBLIC_CONTENT_BUCKET)
      .upload(path, download.data, { contentType, upsert: false });
  } catch (error) {
    throw toApiError(error);
  }
  if (upload.error && storageErrorStatus(upload.error) !== 409) {
    throw fromStorageError(upload.error);
  }
}

/**
 * Removes an image from the given buckets, as far as the caller is allowed (drafts: editors;
 * public: publishers). Best effort: a leftover file is harmless, so failures are ignored.
 */
export async function removeAnnouncementImageFiles(
  client: SmartCityClient,
  input: { path: string; fromDrafts: boolean; fromPublic: boolean },
): Promise<void> {
  const path = checkImagePath(input.path);
  const buckets = [
    ...(input.fromDrafts ? [CONTENT_DRAFTS_BUCKET] : []),
    ...(input.fromPublic ? [PUBLIC_CONTENT_BUCKET] : []),
  ];
  await Promise.allSettled(buckets.map((bucket) => client.storage.from(bucket).remove([path])));
}

/** Seconds a staff preview URL of a draft image stays valid. */
const DRAFT_IMAGE_URL_TTL_SECONDS = 300;

/**
 * A short-lived URL to preview an announcement image from the private drafts bucket (staff of
 * the municipality). Null when it can't be signed (e.g. the file is missing).
 */
export async function signAnnouncementImage(
  client: SmartCityClient,
  input: { path: string },
): Promise<string | null> {
  const path = checkImagePath(input.path);
  try {
    const { data, error } = await client.storage
      .from(CONTENT_DRAFTS_BUCKET)
      .createSignedUrl(path, DRAFT_IMAGE_URL_TTL_SECONDS);
    return error || !data ? null : data.signedUrl;
  } catch {
    return null;
  }
}
