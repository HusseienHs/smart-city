import { SUPPORTED_LOCALES } from '@smart-city/shared';
import { z } from 'zod';

import type { SmartCityClient } from '../client';
import type { Database, Enums } from '../database.types';
import { ApiError } from '../errors/api-error';
import { runListQuery, runMaybeSingleQuery, runMutation } from '../utils/query';
import { requireUserId } from '../utils/session';
import { parseInput } from '../utils/validation';
import { MY_PHONE_COLUMNS, MY_PROFILE_COLUMNS } from './columns';

/*
 * The signed-in user's own data. Every function requires a session (ApiError('unauthorized')
 * otherwise). Row Level Security is the security boundary: reports come from SECURITY DEFINER
 * RPCs that filter on auth.uid(), and profile/contact rows are own-row only. The explicit
 * user-id filters below are defense in depth, never the reason access is allowed.
 *
 * Rows keep the database's snake_case names, like the reference-data functions.
 */

type Functions = Database['public']['Functions'];
type ReportRow = Functions['get_my_reports']['Returns'][number];
type UpdateRow = Functions['get_my_report_updates']['Returns'][number];

// ---------------------------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------------------------

/**
 * One of the caller's reports. The generated types mark every RPC column as non-null, but the
 * SQL returns NULL for these when they don't apply (no address, not rejected, not resolved).
 */
export type MyReport = Omit<ReportRow, 'address' | 'rejection_reason' | 'resolved_at'> & {
  address: string | null;
  rejection_reason: Enums<'report_rejection_reason'> | null;
  resolved_at: string | null;
};

/** A status change visible to the reporter. `note` is null unless staff made it public. */
export type MyReportUpdate = Omit<UpdateRow, 'note'> & { note: string | null };

/** The caller's reports, newest first (`get_my_reports`, own reports only). */
export async function getMyReports(client: SmartCityClient): Promise<MyReport[]> {
  await requireUserId(client);
  return (await runListQuery(client.rpc('get_my_reports'))) as MyReport[];
}

const reportScopeSchema = z.object({ reportId: z.uuid() });
export type ReportScope = z.input<typeof reportScopeSchema>;

/**
 * The public status history of one of the caller's reports, oldest first
 * (`get_my_report_updates`). Someone else's or an unknown report yields an empty list, so ids
 * cannot be probed.
 */
export async function getMyReportUpdates(
  client: SmartCityClient,
  input: ReportScope,
): Promise<MyReportUpdate[]> {
  const { reportId } = parseInput(reportScopeSchema, input);
  await requireUserId(client);
  return (await runListQuery(
    client.rpc('get_my_report_updates', { p_report_id: reportId }),
  )) as MyReportUpdate[];
}

// ---------------------------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------------------------

export interface MyProfile {
  id: string;
  full_name: string | null;
  preferred_locale: Enums<'app_locale'>;
  home_municipality_id: string | null;
  home_neighborhood_id: string | null;
}

/** The caller's profile, or null if it doesn't exist (it is created at sign-up). */
export async function getMyProfile(client: SmartCityClient): Promise<MyProfile | null> {
  const userId = await requireUserId(client);
  return runMaybeSingleQuery(
    client.from('profiles').select(MY_PROFILE_COLUMNS).eq('id', userId).maybeSingle(),
  );
}

const updateMyProfileSchema = z
  .strictObject({
    /** Mirrors the database check: 1–100 characters after trimming; null clears it. */
    fullName: z.string().trim().min(1).max(100).nullable().optional(),
    preferredLocale: z.enum(SUPPORTED_LOCALES).optional(),
    homeMunicipalityId: z.uuid().nullable().optional(),
    homeNeighborhoodId: z.uuid().nullable().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Nothing to update',
  })
  // The database's composite foreign key ensures a neighborhood belongs to the municipality,
  // but (MATCH SIMPLE) skips the check when the municipality is null. Require both together.
  .refine((value) => !value.homeNeighborhoodId || value.homeMunicipalityId, {
    message: 'A neighborhood requires its municipality in the same update',
    path: ['homeNeighborhoodId'],
  });
export type UpdateMyProfileInput = z.input<typeof updateMyProfileSchema>;

/**
 * Updates the caller's profile. Only the columns the database grants are writable; a
 * neighborhood of another municipality is rejected by the database (ApiError('validation')).
 * Clearing the municipality also clears the neighborhood.
 */
export async function updateMyProfile(
  client: SmartCityClient,
  input: UpdateMyProfileInput,
): Promise<MyProfile> {
  const parsed = parseInput(updateMyProfileSchema, input);
  const userId = await requireUserId(client);

  const changes: Database['public']['Tables']['profiles']['Update'] = {};
  if (parsed.fullName !== undefined) changes.full_name = parsed.fullName;
  if (parsed.preferredLocale !== undefined) changes.preferred_locale = parsed.preferredLocale;
  if (parsed.homeMunicipalityId !== undefined) {
    changes.home_municipality_id = parsed.homeMunicipalityId;
    if (parsed.homeMunicipalityId === null) changes.home_neighborhood_id = null;
  }
  if (parsed.homeNeighborhoodId !== undefined && parsed.homeMunicipalityId !== null) {
    changes.home_neighborhood_id = parsed.homeNeighborhoodId;
  }

  const row = await runMaybeSingleQuery(
    client
      .from('profiles')
      .update(changes)
      .eq('id', userId)
      .select(MY_PROFILE_COLUMNS)
      .maybeSingle(),
  );
  if (!row) throw new ApiError('not_found');
  return row;
}

// ---------------------------------------------------------------------------------------------
// Phone (profile_contacts: own row only, optional)
// ---------------------------------------------------------------------------------------------

/** Mirrors the `profile_contacts.phone` check constraint. */
const PHONE_PATTERN = /^\+?[0-9]{7,15}$/;

/** Removes the spaces, dashes, dots and brackets people type; keeps a leading +. */
export function normalizePhone(input: string): string {
  return input.trim().replace(/[\s\-().]/g, '');
}

const phoneSchema = z.object({
  phone: z
    .string()
    .transform(normalizePhone)
    .pipe(z.string().regex(PHONE_PATTERN, 'Invalid phone number')),
});
export type UpsertMyPhoneInput = z.input<typeof phoneSchema>;

/** The caller's phone number, or null when none is saved. */
export async function getMyPhone(client: SmartCityClient): Promise<string | null> {
  const userId = await requireUserId(client);
  const row = await runMaybeSingleQuery<{ phone: string }>(
    client.from('profile_contacts').select(MY_PHONE_COLUMNS).eq('user_id', userId).maybeSingle(),
  );
  return row?.phone ?? null;
}

/**
 * Saves the caller's phone number (normalized) and returns it.
 *
 * Update-then-insert instead of PostgREST's upsert: an upsert also rewrites `user_id` on
 * conflict, and citizens are (deliberately) only granted UPDATE on `phone`. If a concurrent
 * request inserts the row first, the insert's unique violation is answered by updating again.
 */
export async function upsertMyPhone(
  client: SmartCityClient,
  input: UpsertMyPhoneInput,
): Promise<string> {
  const { phone } = parseInput(phoneSchema, input);
  const userId = await requireUserId(client);

  const update = () =>
    runListQuery(
      client
        .from('profile_contacts')
        .update({ phone })
        .eq('user_id', userId)
        .select(MY_PHONE_COLUMNS),
    );

  if ((await update()).length > 0) return phone;

  try {
    await runMutation(client.from('profile_contacts').insert({ user_id: userId, phone }));
  } catch (error) {
    if (!(error instanceof ApiError && error.code === 'conflict')) throw error;
    if ((await update()).length === 0) throw error;
  }
  return phone;
}

/** Removes the caller's phone number. Succeeds when there was none. */
export async function deleteMyPhone(client: SmartCityClient): Promise<void> {
  const userId = await requireUserId(client);
  await runMutation(client.from('profile_contacts').delete().eq('user_id', userId));
}
