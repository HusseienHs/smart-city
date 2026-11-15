import type { LocalizedText } from '@smart-city/shared';
import { z } from 'zod';

import type { SmartCityClient } from '../client';
import type { Database, Enums } from '../database.types';
import { runListQuery, runMaybeSingleQuery } from '../utils/query';
import { requireUserId } from '../utils/session';
import { parseInput, toLocalizedText } from '../utils/validation';

/*
 * The signed-in staff member's own access: memberships, platform-admin flag and invitations.
 * Every function acts as the caller (publishable key + the caller's session); nothing here
 * needs, or may use, a privileged key. The database decides what each call returns:
 *
 * - get_my_staff_memberships() and get_my_staff_invitations() are SECURITY DEFINER functions
 *   that only ever filter on auth.uid() and take no user id.
 * - platform_admins is readable as an own-row-only table.
 * - accept/decline_staff_invitation() verify the invitation is addressed to the caller's
 *   confirmed email, still pending and not expired.
 *
 * Rows keep the database's snake_case names, like the other API modules.
 */

type Functions = Database['public']['Functions'];
type MembershipRow = Functions['get_my_staff_memberships']['Returns'][number];
type InvitationRow = Functions['get_my_staff_invitations']['Returns'][number];

/** One active staff membership of the caller. */
export interface StaffMembership {
  employee_id: string;
  municipality_id: string;
  municipality_code: string;
  municipality_name: LocalizedText;
  municipality_status: Enums<'municipality_status'>;
  role: Enums<'staff_role'>;
  /** Null for roles without a department (municipality admins, intake dispatchers). */
  department_id: string | null;
  department_name: LocalizedText | null;
  job_title: string | null;
}

function toMembership(row: MembershipRow): StaffMembership {
  // The generated types mark every RPC column as non-null; the SQL returns NULL for the
  // department and job title when they don't apply.
  const departmentName = row.department_name as MembershipRow['department_name'] | null;
  return {
    employee_id: row.employee_id,
    municipality_id: row.municipality_id,
    municipality_code: row.municipality_code,
    municipality_name: toLocalizedText(row.municipality_name),
    municipality_status: row.municipality_status,
    role: row.role,
    department_id: (row.department_id as string | null) ?? null,
    department_name: departmentName == null ? null : toLocalizedText(departmentName),
    job_title: (row.job_title as string | null) ?? null,
  };
}

/**
 * The caller's active staff memberships, one per municipality, ordered by municipality code.
 * Empty for citizens, for deactivated staff and for platform admins without a membership.
 */
export async function getMyStaffMemberships(client: SmartCityClient): Promise<StaffMembership[]> {
  await requireUserId(client);
  const rows = await runListQuery(client.rpc('get_my_staff_memberships'));
  return rows.map(toMembership);
}

/**
 * Whether the caller is a platform operator. Row Level Security returns only the caller's own
 * row, so this can't be used to learn about anyone else. Platform admins have no access to
 * report data (see the reports policies).
 */
export async function isPlatformAdmin(client: SmartCityClient): Promise<boolean> {
  await requireUserId(client);
  const row = await runMaybeSingleQuery(
    client.from('platform_admins').select('user_id').limit(1).maybeSingle(),
  );
  return row !== null;
}

/** A pending invitation addressed to the caller's confirmed email address. */
export interface StaffInvitation {
  id: string;
  municipality_id: string;
  municipality_name: LocalizedText;
  role: Enums<'staff_role'>;
  department_name: LocalizedText | null;
  expires_at: string;
}

function toInvitation(row: InvitationRow): StaffInvitation {
  const departmentName = row.department_name as InvitationRow['department_name'] | null;
  return {
    id: row.id,
    municipality_id: row.municipality_id,
    municipality_name: toLocalizedText(row.municipality_name),
    role: row.role,
    department_name: departmentName == null ? null : toLocalizedText(departmentName),
    expires_at: row.expires_at,
  };
}

/** The caller's pending, unexpired invitations, oldest first. Empty until the email is confirmed. */
export async function getMyStaffInvitations(client: SmartCityClient): Promise<StaffInvitation[]> {
  await requireUserId(client);
  const rows = await runListQuery(client.rpc('get_my_staff_invitations'));
  return rows.map(toInvitation);
}

const invitationSchema = z.object({ invitationId: z.uuid() });
export type StaffInvitationInput = z.input<typeof invitationSchema>;

/**
 * Accepts an invitation: the only way a staff membership is created. Returns the new (or
 * reactivated) membership id. Fails with `forbidden` for an invitation that isn't the caller's,
 * was already answered or has expired — without saying which, so ids can't be probed.
 */
export async function acceptStaffInvitation(
  client: SmartCityClient,
  input: StaffInvitationInput,
): Promise<string> {
  const { invitationId } = parseInput(invitationSchema, input);
  await requireUserId(client);
  const employeeId = await runMaybeSingleQuery(
    client.rpc('accept_staff_invitation', { p_invitation_id: invitationId }),
  );
  return employeeId as string;
}

/** Declines an invitation addressed to the caller. Same failure rules as accepting. */
export async function declineStaffInvitation(
  client: SmartCityClient,
  input: StaffInvitationInput,
): Promise<void> {
  const { invitationId } = parseInput(invitationSchema, input);
  await requireUserId(client);
  await runMaybeSingleQuery(
    client.rpc('decline_staff_invitation', { p_invitation_id: invitationId }),
  );
}
