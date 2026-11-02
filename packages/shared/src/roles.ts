/**
 * Municipal staff roles. Mirrors the `public.staff_role` Postgres enum (a database test
 * fails if they drift). Frontends use these for UI decisions only — authorization is always
 * enforced by RLS policies and database functions.
 *
 * - `employee`: reports assigned to them or to their department
 * - `intake_dispatcher`: the unassigned-report queue; routes reports to departments
 * - `department_manager`: all reports of their department; publishes department content
 * - `municipality_admin`: everything in their municipality
 */
export const MUNICIPAL_STAFF_ROLES = [
  'employee',
  'intake_dispatcher',
  'department_manager',
  'municipality_admin',
] as const;
export type MunicipalStaffRole = (typeof MUNICIPAL_STAFF_ROLES)[number];

/** Every role a signed-in user can have. Platform admins are our operators, not municipal staff. */
export const USER_ROLES = ['citizen', ...MUNICIPAL_STAFF_ROLES, 'platform_admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Roles that may access the admin dashboard. */
export const STAFF_ROLES = [
  ...MUNICIPAL_STAFF_ROLES,
  'platform_admin',
] as const satisfies readonly UserRole[];
export type StaffRole = (typeof STAFF_ROLES)[number];

export function isStaffRole(role: UserRole): role is StaffRole {
  return (STAFF_ROLES as readonly UserRole[]).includes(role);
}

export function isMunicipalStaffRole(role: UserRole): role is MunicipalStaffRole {
  return (MUNICIPAL_STAFF_ROLES as readonly UserRole[]).includes(role);
}
