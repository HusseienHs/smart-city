/**
 * Personal details form: values and validation (mirroring the database rules), plus the
 * mapping to the @smart-city/api calls.
 *
 * Supported fields are only what the database has: `profiles.full_name`,
 * `profiles.home_municipality_id`, `profiles.home_neighborhood_id` and
 * `profile_contacts.phone`. Email comes from the auth session and is read-only.
 */
import {
  deleteMyPhone,
  normalizePhone,
  updateMyProfile,
  upsertMyPhone,
  type MyProfile,
  type SmartCityClient,
  type UpdateMyProfileInput,
} from '@smart-city/api';
import { signUpSchema } from '@smart-city/shared';
import type { MessageKey } from '@smart-city/shared/i18n';

import { apiErrorMessageKey } from './api-error-message';

/** Mirrors the `profile_contacts.phone` check constraint. */
const PHONE_PATTERN = /^\+?[0-9]{7,15}$/;

export { normalizePhone };

export interface PersonalDetails {
  fullName: string;
  /** As typed, or '' when not set. */
  phone: string;
  homeMunicipalityId: string | null;
  homeNeighborhoodId: string | null;
}

export type PersonalDetailsErrors = Partial<Record<'fullName' | 'phone', MessageKey>>;

/** Form values from the loaded profile and phone. */
export function toPersonalDetails(
  profile: MyProfile | null,
  phone: string | null,
): PersonalDetails {
  return {
    fullName: profile?.full_name ?? '',
    phone: phone ?? '',
    homeMunicipalityId: profile?.home_municipality_id ?? null,
    homeNeighborhoodId: profile?.home_neighborhood_id ?? null,
  };
}

export function validatePersonalDetails(details: PersonalDetails): PersonalDetailsErrors {
  const errors: PersonalDetailsErrors = {};
  if (!signUpSchema.shape.fullName.safeParse(details.fullName).success) {
    errors.fullName = 'auth.errors.nameRequired';
  }
  const phone = normalizePhone(details.phone);
  if (phone !== '' && !PHONE_PATTERN.test(phone)) {
    errors.phone = 'profile.errors.phoneInvalid';
  }
  return errors;
}

/** The profile update: always sends municipality with neighborhood (the API requires both). */
export function toProfileUpdate(details: PersonalDetails): UpdateMyProfileInput {
  return {
    fullName: details.fullName.trim(),
    homeMunicipalityId: details.homeMunicipalityId,
    homeNeighborhoodId: details.homeMunicipalityId ? details.homeNeighborhoodId : null,
  };
}

/** What to do with the phone: keep, save (normalized) or remove. */
export function phoneChange(
  saved: string | null,
  typed: string,
): { action: 'none' } | { action: 'upsert'; phone: string } | { action: 'delete' } {
  const next = normalizePhone(typed);
  const current = saved ? normalizePhone(saved) : '';
  if (next === current) return { action: 'none' };
  return next === '' ? { action: 'delete' } : { action: 'upsert', phone: next };
}

export type SaveResult =
  | { ok: true }
  /** Nothing was saved. */
  | { ok: false; profileSaved: false; error: MessageKey }
  /** The profile was saved, the phone wasn't: retrying is safe. */
  | { ok: false; profileSaved: true; error: MessageKey };

/** Saves validated details: the profile first, then the phone only if it changed. */
export async function savePersonalDetails(
  client: SmartCityClient,
  savedPhone: string | null,
  details: PersonalDetails,
): Promise<SaveResult> {
  try {
    await updateMyProfile(client, toProfileUpdate(details));
  } catch (error) {
    return { ok: false, profileSaved: false, error: apiErrorMessageKey(error) };
  }
  const phone = phoneChange(savedPhone, details.phone);
  try {
    if (phone.action === 'upsert') await upsertMyPhone(client, { phone: phone.phone });
    if (phone.action === 'delete') await deleteMyPhone(client);
  } catch {
    return { ok: false, profileSaved: true, error: 'profile.phoneSaveError' };
  }
  return { ok: true };
}
