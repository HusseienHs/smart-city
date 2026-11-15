'use server';

import {
  buildAnnouncementImagePath,
  createAnnouncement,
  deleteAnnouncementDraft,
  getStaffAnnouncement,
  isApiError,
  listManagedDepartments,
  listNeighborhoods,
  publishAnnouncementImage,
  removeAnnouncementImageFiles,
  setAnnouncementImage,
  setAnnouncementStatus,
  toApiError,
  updateAnnouncement,
  uploadAnnouncementImage,
  type ApiError,
  type SmartCityClient,
  type StaffAnnouncement,
  type StaffMembership,
} from '@smart-city/api';
import {
  announcementImageProblem,
  announcementSchema,
  announcementUpdateSchema,
  DEFAULT_LOCALE,
  isSupportedLocale,
  type AnnouncementImageType,
  type Locale,
} from '@smart-city/shared';
import { createTranslator, type Translator } from '@smart-city/shared/i18n';
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';

import { getStaffAccess } from '@/lib/auth/staff-context';
import { localizedHref } from '@/lib/i18n/routing';
import type { StaffActionState } from '@/lib/staff/actions';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import {
  canDeleteDraft,
  canDraftAnnouncements,
  canEditAnnouncement,
  canPostMunicipalityWide,
  canPublishAnnouncement,
} from './capabilities';

/*
 * Server Actions for the Notice Board. Each authorizes itself on every call: verified session
 * and an ACTIVE membership (the municipality comes from the database, never the form), a
 * usability check of the role, then every write runs as the caller's own session so RLS,
 * the storage policies and set_announcement_status() make the final decision.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readLocale(formData: FormData): Locale {
  const value = formData.get('locale');
  return isSupportedLocale(value) ? value : DEFAULT_LOCALE;
}

function readText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

/** The chosen image, or null when the file input was left empty. */
function readImage(formData: FormData): File | null {
  const value = formData.get('image');
  return value instanceof File && value.size > 0 ? value : null;
}

const fail = (
  message: string,
  fieldErrors?: Record<string, string>,
  values?: Record<string, string>,
): StaffActionState => ({ status: 'error', message, fieldErrors, values, key: Date.now() });

const succeed = (message: string): StaffActionState => ({
  status: 'success',
  message,
  key: Date.now(),
});

function errorState(
  t: Translator,
  error: unknown,
  values?: Record<string, string>,
): StaffActionState {
  const apiError: ApiError = isApiError(error) ? error : toApiError(error);
  if (apiError.code === 'server' || apiError.code === 'network') {
    console.error('[notices] action failed', apiError.code, apiError.debug);
  }
  return fail(t(apiError.messageKey), undefined, values);
}

interface Actor {
  client: SmartCityClient;
  membership: StaffMembership;
}

async function actingStaff(t: Translator): Promise<Actor | StaffActionState> {
  const access = await getStaffAccess();
  if (access.status !== 'staff') return fail(t('apiErrors.unauthorized'));
  if (!access.active) return fail(t('apiErrors.forbidden'));
  return { client: await createSupabaseServerClient(), membership: access.active };
}

const isActor = (value: Actor | StaffActionState): value is Actor => 'client' in value;

async function findAnnouncement(actor: Actor, announcementId: string) {
  if (!UUID.test(announcementId)) return null;
  return getStaffAnnouncement(actor.client, {
    municipalityId: actor.membership.municipality_id,
    announcementId,
  });
}

/**
 * Copies a published announcement's image to the public bucket (already there counts as done).
 * Returns false when that failed: the announcement is published, but residents see no image.
 */
async function makeImagePublic(actor: Actor, path: string | null): Promise<boolean> {
  if (!path) return true;
  try {
    await publishAnnouncementImage(actor.client, { path });
    return true;
  } catch (error) {
    const apiError = isApiError(error) ? error : toApiError(error);
    console.error('[notices] image publication failed', apiError.code, apiError.debug);
    return false;
  }
}

// ---------------------------------------------------------------------------------------------
// Create / edit
// ---------------------------------------------------------------------------------------------

function readAnnouncement(formData: FormData) {
  return {
    title: {
      he: readText(formData, 'titleHe'),
      ar: readText(formData, 'titleAr'),
      en: readText(formData, 'titleEn'),
    },
    body: {
      he: readText(formData, 'bodyHe'),
      ar: readText(formData, 'bodyAr'),
      en: readText(formData, 'bodyEn'),
    },
    severity: readText(formData, 'severity'),
    departmentId: readText(formData, 'departmentId') || null,
    neighborhoodId: readText(formData, 'neighborhoodId') || null,
    expiresAt: readText(formData, 'expiresAt') || null,
  };
}

const FIELD_NAMES: Record<string, Record<string, string>> = {
  title: { he: 'titleHe', ar: 'titleAr', en: 'titleEn' },
  body: { he: 'bodyHe', ar: 'bodyAr', en: 'bodyEn' },
};

function fieldErrors(
  t: Translator,
  issues: readonly { path: readonly PropertyKey[]; code: string }[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const [first, second] = issue.path;
    if (first === 'title' || first === 'body') {
      const field = FIELD_NAMES[first]![String(second)] ?? FIELD_NAMES[first]!.he!;
      errors[field] =
        issue.code === 'too_big'
          ? t('adminNotices.form.tooLong')
          : t(
              first === 'title'
                ? 'adminNotices.form.titleRequired'
                : 'adminNotices.form.bodyRequired',
            );
    } else if (first === 'expiresAt') errors.expiresAt = t('adminNotices.form.expiryInvalid');
    else if (first === 'neighborhoodId')
      errors.neighborhoodId = t('adminNotices.form.neighborhoodInvalid');
    else if (first === 'severity') errors.severity = t('apiErrors.validation');
    else if (first === 'departmentId') errors.departmentId = t('apiErrors.validation');
  }
  return errors;
}

/**
 * Creates an announcement (no `announcementId`) or edits one: text, severity, neighborhood,
 * expiry and image. A new announcement starts as a draft and, when asked and allowed, is
 * published at once. Employees and managers always post for their own department.
 */
export async function saveAnnouncementAction(
  _previous: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const locale = readLocale(formData);
  const t = createTranslator(locale);
  const announcementId = readText(formData, 'announcementId');
  const editing = announcementId !== '';
  const input = readAnnouncement(formData);
  const image = readImage(formData);
  const removeImage = readText(formData, 'removeImage') === 'true';
  const publishNow = !editing && readText(formData, 'publish') === 'true';
  const values: Record<string, string> = {
    titleHe: input.title.he,
    titleAr: input.title.ar,
    titleEn: input.title.en,
    bodyHe: input.body.he,
    bodyAr: input.body.ar,
    bodyEn: input.body.en,
    severity: input.severity,
    departmentId: input.departmentId ?? '',
    neighborhoodId: input.neighborhoodId ?? '',
    expiresAtLocal: readText(formData, 'expiresAtLocal'),
    publish: publishNow ? 'true' : '',
    removeImage: removeImage ? 'true' : '',
  };

  let actor: Actor;
  let existing: StaffAnnouncement | null = null;
  try {
    const found = await actingStaff(t);
    if (!isActor(found)) return { ...found, values };
    actor = found;
    if (editing) existing = await findAnnouncement(actor, announcementId);
  } catch (error) {
    return errorState(t, error, values);
  }
  const { role, department_id: ownDepartment, municipality_id: municipalityId } = actor.membership;
  if (editing) {
    if (!existing || !canEditAnnouncement(role, ownDepartment, existing)) {
      return fail(t('apiErrors.forbidden'));
    }
  } else {
    if (!canDraftAnnouncements(role, ownDepartment)) return fail(t('apiErrors.forbidden'));
    // Non-admins post for their own department only, whatever the form says.
    if (!canPostMunicipalityWide(role)) input.departmentId = ownDepartment;
  }

  const { departmentId, ...updateInput } = input;
  const parsed = editing
    ? announcementUpdateSchema.safeParse(updateInput)
    : announcementSchema.safeParse(input);
  const errors = parsed.success ? {} : fieldErrors(t, parsed.error.issues);
  const expiresAt = parsed.success ? parsed.data.expiresAt : null;
  // An unchanged expiry may already have passed; only a newly chosen one must be in the future.
  const unchangedExpiry =
    expiresAt !== null &&
    existing?.expires_at != null &&
    new Date(expiresAt).getTime() === new Date(existing.expires_at).getTime();
  if (expiresAt && !unchangedExpiry && new Date(expiresAt) <= new Date()) {
    errors.expiresAt = t('adminNotices.form.expiryPast');
  }
  const imageProblem = image ? announcementImageProblem(image) : null;
  if (imageProblem) {
    errors.image =
      imageProblem === 'type' ? t('adminNotices.form.imageType') : t('adminNotices.form.imageSize');
  }
  if (Object.keys(errors).length > 0 || !parsed.success) {
    return fail(Object.values(errors)[0] ?? t('apiErrors.validation'), errors, values);
  }

  let imagePublic = true;
  let savedId = '';
  try {
    const [departments, neighborhoods] = await Promise.all([
      !editing && departmentId ? listManagedDepartments(actor.client, { municipalityId }) : null,
      input.neighborhoodId ? listNeighborhoods(actor.client, { municipalityId }) : null,
    ]);
    if (departments && !departments.some((d) => d.id === departmentId && d.isActive)) {
      const message = t('adminNotices.form.departmentInvalid');
      return fail(message, { departmentId: message }, values);
    }
    if (neighborhoods && !neighborhoods.some((n) => n.id === input.neighborhoodId)) {
      const message = t('adminNotices.form.neighborhoodInvalid');
      return fail(message, { neighborhoodId: message }, values);
    }

    const saved = editing
      ? await updateAnnouncement(actor.client, {
          municipalityId,
          announcementId: existing!.id,
          announcement: parsed.data,
        })
      : await createAnnouncement(actor.client, {
          municipalityId,
          announcement: { ...parsed.data, departmentId: input.departmentId },
        });
    savedId = saved.id;
    const publisher = canPublishAnnouncement(role, ownDepartment, saved.department_id);
    const previousImage = saved.image_path;
    let imagePath = previousImage;

    if (image) {
      const path = buildAnnouncementImagePath({
        municipalityId,
        announcementId: saved.id,
        imageId: crypto.randomUUID(),
        mimeType: image.type as AnnouncementImageType,
      });
      try {
        await uploadAnnouncementImage(actor.client, {
          path,
          file: image,
          contentType: image.type as AnnouncementImageType,
        });
        await setAnnouncementImage(actor.client, {
          municipalityId,
          announcementId: saved.id,
          imagePath: path,
        });
      } catch (error) {
        // Don't leave a stray file or a half-created announcement behind; the person tries again.
        await removeAnnouncementImageFiles(actor.client, {
          path,
          fromDrafts: true,
          fromPublic: false,
        });
        if (!editing) {
          await deleteAnnouncementDraft(actor.client, {
            municipalityId,
            announcementId: saved.id,
          }).catch(() => undefined);
        }
        const message = t('adminNotices.form.imageFailed');
        console.error('[notices] image upload failed', isApiError(error) ? error.code : 'unknown');
        return fail(message, { image: message }, values);
      }
      imagePath = path;
    } else if (removeImage && previousImage) {
      await setAnnouncementImage(actor.client, {
        municipalityId,
        announcementId: saved.id,
        imagePath: null,
      });
      imagePath = null;
    }

    let status = saved.status;
    if (publishNow && publisher) {
      await setAnnouncementStatus(actor.client, { announcementId: saved.id, status: 'published' });
      status = 'published';
    }
    // Every save of a published announcement makes sure its image is public, so saving again
    // repairs an earlier failed copy.
    if (status === 'published') imagePublic = await makeImagePublic(actor, imagePath);
    if (previousImage && imagePath !== previousImage) {
      await removeAnnouncementImageFiles(actor.client, {
        path: previousImage,
        fromDrafts: true,
        fromPublic: publisher,
      });
    }
  } catch (error) {
    return errorState(t, error, values);
  }
  if (!editing) {
    // A failed image copy opens the new announcement (with a warning) instead of keeping this
    // form, whose resubmission would create a duplicate; saving it there retries the copy.
    redirect(
      localizedHref(locale, imagePublic ? '/notices' : `/notices/${savedId}?image=not-public`),
    );
  }
  refresh();
  if (!imagePublic) return fail(t('adminNotices.imageNotPublic'));
  return succeed(t('adminNotices.form.saved'));
}

// ---------------------------------------------------------------------------------------------
// Publish / archive / delete
// ---------------------------------------------------------------------------------------------

export async function setAnnouncementStatusAction(
  _previous: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const t = createTranslator(readLocale(formData));
  const status = readText(formData, 'status');
  if (status !== 'published' && status !== 'archived') return fail(t('apiErrors.validation'));
  try {
    const actor = await actingStaff(t);
    if (!isActor(actor)) return actor;
    const item = await findAnnouncement(actor, readText(formData, 'announcementId'));
    const { role, department_id: ownDepartment } = actor.membership;
    if (!item || !canPublishAnnouncement(role, ownDepartment, item.department_id)) {
      return fail(t('apiErrors.forbidden'));
    }
    if (status === 'published' && item.status !== 'draft') {
      return fail(t('adminNotices.actions.notDraft'));
    }
    await setAnnouncementStatus(actor.client, { announcementId: item.id, status });
    if (status === 'published' && !(await makeImagePublic(actor, item.image_path))) {
      refresh();
      return fail(t('adminNotices.imageNotPublic'));
    }
    if (status === 'archived' && item.image_path) {
      // Archived announcements aren't shown; take the image out of the public bucket too.
      await removeAnnouncementImageFiles(actor.client, {
        path: item.image_path,
        fromDrafts: false,
        fromPublic: true,
      });
    }
  } catch (error) {
    return errorState(t, error);
  }
  refresh();
  return succeed(
    status === 'published'
      ? t('adminNotices.actions.published')
      : t('adminNotices.actions.archived'),
  );
}

export async function deleteAnnouncementAction(
  _previous: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const locale = readLocale(formData);
  const t = createTranslator(locale);
  try {
    const actor = await actingStaff(t);
    if (!isActor(actor)) return actor;
    const item = await findAnnouncement(actor, readText(formData, 'announcementId'));
    const {
      role,
      department_id: ownDepartment,
      municipality_id: municipalityId,
    } = actor.membership;
    if (
      !item ||
      item.status !== 'draft' ||
      !canDeleteDraft(role, ownDepartment, item.department_id)
    ) {
      return fail(t('apiErrors.forbidden'));
    }
    // The storage policy needs the announcement row, so the image goes first.
    if (item.image_path) {
      await removeAnnouncementImageFiles(actor.client, {
        path: item.image_path,
        fromDrafts: true,
        fromPublic: false,
      });
    }
    await deleteAnnouncementDraft(actor.client, { municipalityId, announcementId: item.id });
  } catch (error) {
    return errorState(t, error);
  }
  if (readText(formData, 'redirect') === 'list') redirect(localizedHref(locale, '/notices'));
  refresh();
  return succeed(t('adminNotices.actions.deleted'));
}
