import { z } from 'zod';

import { SUPPORTED_LOCALES } from './locales';
import {
  REPORT_CATEGORIES,
  REPORT_PRIORITIES,
  REPORT_REJECTION_REASONS,
  REPORT_STATUSES,
  REPORT_VISIBILITIES,
  STATUSES_REQUIRING_PUBLIC_NOTE,
} from './reports';

/**
 * Text stored per language in jsonb columns. Mirrors `private.is_localized_text`:
 * only he/ar/en keys, string values, and Hebrew is required.
 */
export const localizedTextSchema = z.strictObject({
  he: z.string().trim().min(1),
  ar: z.string().optional(),
  en: z.string().optional(),
});
export type LocalizedText = z.infer<typeof localizedTextSchema>;

/** Upper bound for photos attached to a single report. */
export const MAX_REPORT_PHOTOS = 5;
/** 10 MB, enforced again by the storage bucket policy. */
export const MAX_REPORT_PHOTO_BYTES = 10 * 1024 * 1024;
export const ALLOWED_REPORT_PHOTO_TYPES = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/webp',
] as const;

export const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  /** Horizontal accuracy in meters, as reported by the device. */
  accuracy: z.number().nonnegative().optional(),
});
export type Coordinates = z.infer<typeof coordinatesSchema>;

export const createReportSchema = z.object({
  municipalityId: z.uuid(),
  neighborhoodId: z.uuid().optional(),
  category: z.enum(REPORT_CATEGORIES),
  description: z.string().trim().min(10).max(2000),
  location: coordinatesSchema,
  /** Human-readable address from reverse geocoding or user input. */
  address: z.string().trim().max(300).optional(),
  /** Omitted → category default (sensitive categories default to private). */
  visibility: z.enum(REPORT_VISIBILITIES).optional(),
});
export type CreateReportInput = z.infer<typeof createReportSchema>;

export const reportPhotoSchema = z.object({
  mimeType: z.enum(ALLOWED_REPORT_PHOTO_TYPES),
  sizeBytes: z.number().int().positive().max(MAX_REPORT_PHOTO_BYTES),
});

/**
 * Mirrors the checks in `public.update_report_status` so forms can show errors early.
 * The database re-validates everything.
 */
export const updateReportStatusSchema = z
  .object({
    reportId: z.uuid(),
    status: z.enum(REPORT_STATUSES),
    note: z.string().trim().max(2000).optional(),
    // Internal by default; resolving and rejecting require an explicit public note.
    noteIsPublic: z.boolean().default(false),
    rejectionReason: z.enum(REPORT_REJECTION_REASONS).optional(),
    duplicateOfId: z.uuid().optional(),
  })
  .superRefine((value, ctx) => {
    const requiresPublicNote = (STATUSES_REQUIRING_PUBLIC_NOTE as readonly string[]).includes(
      value.status,
    );
    if (requiresPublicNote && (!value.note || value.note.length < 5 || !value.noteIsPublic)) {
      ctx.addIssue({ code: 'custom', path: ['note'], message: 'A public note is required' });
    }
    if (value.status === 'rejected' && !value.rejectionReason) {
      ctx.addIssue({
        code: 'custom',
        path: ['rejectionReason'],
        message: 'A rejection reason is required',
      });
    }
    if (value.status !== 'rejected' && value.rejectionReason) {
      ctx.addIssue({
        code: 'custom',
        path: ['rejectionReason'],
        message: 'Only rejected reports have a rejection reason',
      });
    }
    if (value.rejectionReason === 'duplicate' && !value.duplicateOfId) {
      ctx.addIssue({
        code: 'custom',
        path: ['duplicateOfId'],
        message: 'Select the original report',
      });
    }
  });
export type UpdateReportStatusInput = z.infer<typeof updateReportStatusSchema>;

export const assignReportSchema = z
  .object({
    reportId: z.uuid(),
    departmentId: z.uuid().optional(),
    assigneeId: z.uuid().optional(),
    priority: z.enum(REPORT_PRIORITIES).optional(),
  })
  .refine((value) => Boolean(value.departmentId ?? value.assigneeId), {
    message: 'A department or an employee is required',
    path: ['departmentId'],
  });
export type AssignReportInput = z.infer<typeof assignReportSchema>;

// Keyboards often add a trailing space after an email suggestion.
const emailSchema = z.string().trim().pipe(z.email());
/** Lets callers that only see issue messages tell a too-long password from a too-short one. */
export const PASSWORD_TOO_LONG_MESSAGE = 'password_too_long';
const newPasswordSchema = z.string().min(8).max(72, PASSWORD_TOO_LONG_MESSAGE);

export const signUpSchema = z.object({
  email: emailSchema,
  password: newPasswordSchema,
  fullName: z.string().trim().min(2).max(100),
  preferredLocale: z.enum(SUPPORTED_LOCALES),
  /** The city the user lives in: becomes the profile's home municipality. */
  homeMunicipalityId: z.uuid(),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});
export type SignInInput = z.infer<typeof signInSchema>;

/** Used to request a password reset or another verification email. */
export const emailOnlySchema = z.object({ email: emailSchema });
export type EmailOnlyInput = z.infer<typeof emailOnlySchema>;

export const updatePasswordSchema = z.object({ password: newPasswordSchema });
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
