import { z } from 'zod';

/*
 * Municipal content (announcements). Mirrors the database checks in
 * supabase/migrations/20261103000500_content.sql so forms can show errors early; the database
 * re-validates everything (is_localized_text, RLS, set_announcement_status) and is the authority.
 */

export const ANNOUNCEMENT_SEVERITIES = ['info', 'important', 'emergency'] as const;
export type AnnouncementSeverity = (typeof ANNOUNCEMENT_SEVERITIES)[number];

export const ANNOUNCEMENT_TITLE_MAX_LENGTH = 150;
export const ANNOUNCEMENT_BODY_MAX_LENGTH = 5000;

function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));
}

function localized(max: number) {
  return z.strictObject({
    he: z.string().trim().min(1).max(max),
    ar: optionalText(max),
    en: optionalText(max),
  });
}

/** A new announcement: text in Hebrew (required), Arabic and English, and how it is shown. */
export const announcementSchema = z.strictObject({
  title: localized(ANNOUNCEMENT_TITLE_MAX_LENGTH),
  body: localized(ANNOUNCEMENT_BODY_MAX_LENGTH),
  severity: z.enum(ANNOUNCEMENT_SEVERITIES),
  /** null = municipality-wide (municipality admins only; enforced by RLS). */
  departmentId: z.uuid().nullable(),
  /** null = every resident of the municipality; otherwise residents of that neighborhood. */
  neighborhoodId: z.uuid().nullable(),
  /** ISO timestamp after which residents no longer see it; null = no expiry. */
  expiresAt: z.iso.datetime({ offset: true }).nullable(),
});
export type AnnouncementInput = z.input<typeof announcementSchema>;
export type AnnouncementValues = z.output<typeof announcementSchema>;

/** Editing: the department can't change (it decides who may publish; not in the update grant). */
export const announcementUpdateSchema = announcementSchema.omit({ departmentId: true });
export type AnnouncementUpdateInput = z.input<typeof announcementUpdateSchema>;

/** The `content-drafts` / `public-content` buckets accept these (storage migration). */
export const ANNOUNCEMENT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AnnouncementImageType = (typeof ANNOUNCEMENT_IMAGE_TYPES)[number];
export const MAX_ANNOUNCEMENT_IMAGE_BYTES = 5 * 1024 * 1024;

export type AnnouncementImageProblem = 'type' | 'size';

/** Checks a file before uploading; storage checks again with the stored file's metadata. */
export function announcementImageProblem(file: {
  type: string;
  size: number;
}): AnnouncementImageProblem | null {
  if (!(ANNOUNCEMENT_IMAGE_TYPES as readonly string[]).includes(file.type)) return 'type';
  if (file.size < 1 || file.size > MAX_ANNOUNCEMENT_IMAGE_BYTES) return 'size';
  return null;
}
