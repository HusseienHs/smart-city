import 'server-only';

import {
  getMyProfile,
  getMyStaffMemberships,
  isPlatformAdmin,
  type StaffMembership,
} from '@smart-city/api';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import { isSupabaseConfigured } from '@/lib/env';
import { localizedHref } from '@/lib/i18n/routing';
import { getLocale } from '@/lib/i18n/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { ACTIVE_MUNICIPALITY_COOKIE, resolveActiveMembership } from './active-municipality';
import type { AccessRole } from './permissions';
import { ACCESS_PATH, signInHref } from './routes';

/**
 * The Data Access Layer for "who is this and what may they open": the single place where the
 * session, the staff memberships and the active municipality are read.
 *
 * - The user comes from `getClaims()`, which verifies the token signature (never from the
 *   unverified session object).
 * - Memberships come from the database for that verified user (get_my_staff_memberships).
 * - The active-municipality cookie is only a preference, matched against those memberships.
 *
 * Cached per request only (`React.cache`), never across requests or users: deactivating a
 * staff member takes effect on their very next request.
 */

export interface StaffUser {
  id: string;
  email: string | null;
  fullName: string | null;
}

export interface StaffContext {
  status: 'staff';
  user: StaffUser;
  /** Every active membership, for the municipality switcher. */
  memberships: readonly StaffMembership[];
  /** The municipality being worked in; null for a platform admin without a membership. */
  active: StaffMembership | null;
  isPlatformAdmin: boolean;
  /** The role in the active municipality, or `platform_admin` without one. */
  role: AccessRole;
}

export type StaffAccess =
  | { status: 'unconfigured' }
  | { status: 'signed-out' }
  /** Signed in, but neither a municipal staff member nor a platform admin. */
  | { status: 'no-access'; user: StaffUser }
  | StaffContext;

export const getStaffAccess = cache(async (): Promise<StaffAccess> => {
  if (!isSupabaseConfigured) return { status: 'unconfigured' };

  const client = await createSupabaseServerClient();
  const { data, error } = await client.auth.getClaims();
  const claims = data?.claims;
  if (error || typeof claims?.sub !== 'string') return { status: 'signed-out' };

  const [memberships, platformAdmin, profile] = await Promise.all([
    getMyStaffMemberships(client),
    isPlatformAdmin(client),
    getMyProfile(client),
  ]);
  const user: StaffUser = {
    id: claims.sub,
    email: typeof claims.email === 'string' ? claims.email : null,
    fullName: profile?.full_name ?? null,
  };
  if (memberships.length === 0 && !platformAdmin) return { status: 'no-access', user };

  const requested = (await cookies()).get(ACTIVE_MUNICIPALITY_COOKIE)?.value;
  const active = resolveActiveMembership(memberships, requested);
  return {
    status: 'staff',
    user,
    memberships,
    active,
    isPlatformAdmin: platformAdmin,
    role: active?.role ?? 'platform_admin',
  };
});

/**
 * The staff context, or a redirect: signed-out visitors go to sign-in, signed-in users
 * without staff access go to the access page (invitations / no access).
 */
export async function requireStaff(): Promise<StaffContext> {
  const access = await getStaffAccess();
  if (access.status === 'staff') return access;
  const locale = await getLocale();
  if (access.status === 'no-access') redirect(localizedHref(locale, ACCESS_PATH));
  redirect(signInHref(locale, undefined, access.status === 'signed-out' ? 'session' : undefined));
}

/** The signed-in user (staff or not), or a redirect to sign-in. */
export async function requireSignedIn(): Promise<
  Exclude<StaffAccess, { status: 'unconfigured' | 'signed-out' }>
> {
  const access = await getStaffAccess();
  if (access.status === 'staff' || access.status === 'no-access') return access;
  redirect(signInHref(await getLocale()));
}
