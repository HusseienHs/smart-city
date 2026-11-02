/**
 * Platform roles. The authoritative copy lives in the database (Postgres enum + RLS);
 * this list must stay in sync with it. Frontends use it for UI decisions only —
 * authorization is always enforced by RLS / server code.
 */
export const USER_ROLES = [
  'citizen',
  'employee',
  'department_manager',
  'municipality_admin',
  'platform_admin',
] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Roles that belong to municipality staff and may access the admin dashboard. */
export const STAFF_ROLES = [
  'employee',
  'department_manager',
  'municipality_admin',
  'platform_admin',
] as const satisfies readonly UserRole[];
export type StaffRole = (typeof STAFF_ROLES)[number];

export function isStaffRole(role: UserRole): role is StaffRole {
  return (STAFF_ROLES as readonly UserRole[]).includes(role);
}
