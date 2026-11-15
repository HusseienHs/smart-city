import {
  inviteStaffSchema,
  setEmployeeActiveSchema,
  setEmployeeRoleSchema,
  updateEmployeeJobTitleSchema,
  type InviteStaffInput,
  type SetEmployeeActiveInput,
  type SetEmployeeRoleInput,
  type UpdateEmployeeJobTitleInput,
} from '@smart-city/shared';
import { z } from 'zod';

import type { SmartCityClient } from '../client';
import type { Database, Enums } from '../database.types';
import { ApiError } from '../errors/api-error';
import { runListQuery, runMaybeSingleQuery } from '../utils/query';
import { requireUserId } from '../utils/session';
import { parseInput } from '../utils/validation';

/*
 * Staff administration for municipality admins: the staff directory, invitations and
 * memberships. Everything runs as the signed-in admin; the database decides:
 *
 * - get_municipality_staff(): active municipality admins only; names, never user ids.
 * - staff_invitations: insert/read by admins of that municipality (RLS); server-controlled
 *   fields are set by a trigger; one pending invitation per address.
 * - revoke_staff_invitation(), set_employee_role(): admin-only SECURITY DEFINER RPCs.
 * - employees: admins may update only job_title and is_active directly; a trigger blocks
 *   self-deactivation and removing the last active admin, and deactivation hands open reports
 *   back to the department queue.
 *
 * Memberships are never created here: only accept_staff_invitation() creates them.
 */

const scope = z.strictObject({ municipalityId: z.uuid() });

// ---------------------------------------------------------------------------------------------
// Directory
// ---------------------------------------------------------------------------------------------

type StaffRow = Database['public']['Functions']['get_municipality_staff']['Returns'][number];

/** A member of the municipality's staff, active or not. No user id or contact details. */
export interface StaffMember {
  employee_id: string;
  full_name: string | null;
  role: Enums<'staff_role'>;
  department_id: string | null;
  job_title: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Every membership of the municipality with names (get_municipality_staff, admins only). */
export async function listMunicipalityStaff(
  client: SmartCityClient,
  input: z.input<typeof scope>,
): Promise<StaffMember[]> {
  const { municipalityId } = parseInput(scope, input);
  await requireUserId(client);
  const rows = await runListQuery(
    client.rpc('get_municipality_staff', { p_municipality_id: municipalityId }),
  );
  // The generated types mark RPC columns non-null; the SQL returns NULL where they don't apply.
  return rows.map((row: StaffRow) => ({
    employee_id: row.employee_id,
    full_name: (row.full_name as string | null) || null,
    role: row.role,
    department_id: (row.department_id as string | null) ?? null,
    job_title: (row.job_title as string | null) ?? null,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

// ---------------------------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------------------------

/** Never invited_by / accepted_user_id: those are user ids. */
export const STAFF_INVITATION_COLUMNS =
  'id, municipality_id, email, role, department_id, job_title, status, expires_at, responded_at, created_at' as const;

export type InvitationState = 'pending' | 'expired' | 'accepted' | 'declined' | 'revoked';

export interface StaffInvitationRecord {
  id: string;
  municipality_id: string;
  email: string;
  role: Enums<'staff_role'>;
  department_id: string | null;
  job_title: string | null;
  status: Enums<'invitation_status'>;
  /** `pending` past its expiry is shown as `expired` (the database keeps it `pending`). */
  state: InvitationState;
  expires_at: string;
  responded_at: string | null;
  created_at: string;
}

/** The state to show: a pending invitation past its expiry can no longer be accepted. */
export function invitationState(
  invitation: { status: Enums<'invitation_status'>; expires_at: string },
  now: Date = new Date(),
): InvitationState {
  if (invitation.status === 'pending' && Date.parse(invitation.expires_at) <= now.getTime()) {
    return 'expired';
  }
  return invitation.status;
}

type InvitationRow = Omit<StaffInvitationRecord, 'state'>;

const toInvitation = (row: InvitationRow, now?: Date): StaffInvitationRecord => ({
  ...row,
  state: invitationState(row, now),
});

/** The municipality's invitations, newest first. Admins only (RLS: others get none). */
export async function listStaffInvitations(
  client: SmartCityClient,
  input: z.input<typeof scope>,
): Promise<StaffInvitationRecord[]> {
  const { municipalityId } = parseInput(scope, input);
  await requireUserId(client);
  const rows = await runListQuery(
    client
      .from('staff_invitations')
      .select(STAFF_INVITATION_COLUMNS)
      .eq('municipality_id', municipalityId)
      .order('created_at', { ascending: false })
      .order('id'),
  );
  const now = new Date();
  return (rows as InvitationRow[]).map((row) => toInvitation(row, now));
}

const createInvitationSchema = z.strictObject({
  municipalityId: z.uuid(),
  invitation: inviteStaffSchema,
});

/**
 * Invites an address to the municipality's staff. Fails with `conflict` when a pending
 * invitation for that address already exists — including an expired one, which must be revoked
 * first. No email is sent: the admin shares the onboarding link.
 */
export async function createStaffInvitation(
  client: SmartCityClient,
  input: { municipalityId: string; invitation: InviteStaffInput },
): Promise<StaffInvitationRecord> {
  const { municipalityId, invitation } = parseInput(createInvitationSchema, input);
  await requireUserId(client);
  const row = await runMaybeSingleQuery(
    client
      .from('staff_invitations')
      .insert({
        municipality_id: municipalityId,
        email: invitation.email,
        role: invitation.role,
        department_id: invitation.departmentId,
        job_title: invitation.jobTitle,
      })
      .select(STAFF_INVITATION_COLUMNS)
      .single(),
  );
  if (!row)
    throw new ApiError('server', { debug: { message: 'Invitation insert returned no row' } });
  return toInvitation(row as InvitationRow);
}

const invitationRef = z.strictObject({ invitationId: z.uuid() });

/** Revokes a pending (or expired) invitation (revoke_staff_invitation, admins only). */
export async function revokeStaffInvitation(
  client: SmartCityClient,
  input: z.input<typeof invitationRef>,
): Promise<void> {
  const { invitationId } = parseInput(invitationRef, input);
  await requireUserId(client);
  await runMaybeSingleQuery(
    client.rpc('revoke_staff_invitation', { p_invitation_id: invitationId }),
  );
}

// ---------------------------------------------------------------------------------------------
// Memberships
// ---------------------------------------------------------------------------------------------

/**
 * Changes role and/or department (set_employee_role). When the employee leaves their
 * department, their open reports go to `reassignTo` (an active member of the previous
 * department) or back to that department's queue. Returns how many reports were handed over.
 */
export async function setEmployeeRole(
  client: SmartCityClient,
  input: SetEmployeeRoleInput,
): Promise<number> {
  const value = parseInput(setEmployeeRoleSchema, input);
  await requireUserId(client);
  const moved = await runMaybeSingleQuery(
    client.rpc('set_employee_role', {
      p_employee_id: value.employeeId,
      p_role: value.role,
      // The generated types mark it non-null; NULL is valid for roles without a department.
      p_department_id: value.departmentId as string,
      p_reassign_to: value.reassignTo ?? undefined,
    }),
  );
  return typeof moved === 'number' ? moved : 0;
}

const jobTitleSchema = updateEmployeeJobTitleSchema.extend({ municipalityId: z.uuid() });

/** Updates an employee's job title (admins of that municipality only). */
export async function updateEmployeeJobTitle(
  client: SmartCityClient,
  input: UpdateEmployeeJobTitleInput & { municipalityId: string },
): Promise<void> {
  const { municipalityId, employeeId, jobTitle } = parseInput(jobTitleSchema, input);
  await requireUserId(client);
  const row = await runMaybeSingleQuery(
    client
      .from('employees')
      .update({ job_title: jobTitle })
      .eq('id', employeeId)
      .eq('municipality_id', municipalityId)
      .select('id')
      .maybeSingle(),
  );
  if (!row) throw new ApiError('forbidden');
}

const activeSchema = setEmployeeActiveSchema.extend({ municipalityId: z.uuid() });

/**
 * Activates or deactivates a membership. Deactivation hands the employee's open reports back to
 * their department's queue (database trigger). You can't change your own status, and the last
 * active admin can't be deactivated.
 */
export async function setEmployeeActive(
  client: SmartCityClient,
  input: SetEmployeeActiveInput & { municipalityId: string },
): Promise<void> {
  const { municipalityId, employeeId, isActive } = parseInput(activeSchema, input);
  await requireUserId(client);
  const row = await runMaybeSingleQuery(
    client
      .from('employees')
      .update({ is_active: isActive })
      .eq('id', employeeId)
      .eq('municipality_id', municipalityId)
      .select('id')
      .maybeSingle(),
  );
  if (!row) throw new ApiError('forbidden');
}

// ---------------------------------------------------------------------------------------------
// Specific reasons for the UI
// ---------------------------------------------------------------------------------------------

/**
 * Exact messages raised by the staff functions and triggers. A database test asserts they still
 * exist (supabase/tests/staff-admin-api.test.ts).
 */
export const STAFF_ADMIN_MESSAGES = {
  self_change: [
    'You cannot change your own role or department',
    'You cannot change your own status',
  ],
  last_admin: ['A municipality must keep at least one active admin'],
  department_required: ['This role requires a department'],
  department_unavailable: ['Department not found'],
  reassign_not_leaving: ['Reassignment only applies when the employee leaves their department'],
  reassign_invalid: [
    'Open reports can only be handed to an active member of the previous department',
  ],
  invitation_unavailable: ['Invitation not found or no longer valid'],
  already_member: ['You are already a staff member of this municipality'],
  invited_department_inactive: ['The invited department is no longer active'],
  own_invitation: ['You cannot accept an invitation you created'],
} as const;

export type StaffAdminIssue = keyof typeof STAFF_ADMIN_MESSAGES | 'invitation_pending';

/** A specific, explainable reason for a failed staff action, or null. */
export function staffAdminIssue(error: unknown): StaffAdminIssue | null {
  if (!(error instanceof ApiError)) return null;
  // staff_invitations_one_pending_idx: a pending invitation for this address already exists.
  if (error.code === 'conflict' && error.debug.code === '23505') return 'invitation_pending';
  if (error.code !== 'validation' && error.code !== 'forbidden') return null;
  const message = error.debug.message ?? '';
  for (const [issue, messages] of Object.entries(STAFF_ADMIN_MESSAGES)) {
    if ((messages as readonly string[]).includes(message)) return issue as StaffAdminIssue;
  }
  return null;
}
