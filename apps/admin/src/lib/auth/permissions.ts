import { MUNICIPAL_STAFF_ROLES, type MunicipalStaffRole } from '@smart-city/shared';

import type { ModuleId } from '@/lib/navigation';

/**
 * Which roles see which dashboard module. This is USER EXPERIENCE ONLY: it hides areas a role
 * cannot use. What anyone can read or change is decided by the database (RLS policies and
 * SECURITY DEFINER functions), which is why every entry cites the rule it mirrors.
 *
 * Roles act within their ACTIVE municipality. A platform admin without a municipal membership
 * acts as `platform_admin`; with a membership, the membership's role applies.
 */
export type AccessRole = MunicipalStaffRole | 'platform_admin';

const ALL_MUNICIPAL: readonly AccessRole[] = MUNICIPAL_STAFF_ROLES;
const EVERYONE: readonly AccessRole[] = [...MUNICIPAL_STAFF_ROLES, 'platform_admin'];

export const MODULE_ACCESS: Readonly<Record<ModuleId, readonly AccessRole[]>> = {
  // Landing page for everyone; its data is scoped by RLS per role.
  overview: EVERYONE,
  // private.can_access_report(): admin → all; manager → own department; employee → assigned
  // to them; dispatcher → the unassigned queue. Platform admins have no report access at all.
  reports: ALL_MUNICIPAL,
  map: ALL_MUNICIPAL,
  // private.can_draft_content(): admin, or employee/manager for their department.
  // Dispatchers never draft or publish content.
  notices: ['municipality_admin', 'department_manager', 'employee'],
  // Not in the database yet; planned to follow the content model's publishers.
  events: ['municipality_admin', 'department_manager'],
  // get_colleagues(): any active staff member sees active colleagues' names. Inviting,
  // deactivating and role changes are municipality-admin only (enforced in the database).
  employees: ALL_MUNICIPAL,
  // Departments are readable by all staff; only municipality admins may create or edit them.
  departments: ['municipality_admin', 'department_manager'],
  analytics: ['municipality_admin', 'department_manager'],
  // municipalities UPDATE policy: municipality admins of that municipality only.
  settings: ['municipality_admin'],
  // set_employee_role(): municipality admins only. Platform admins may read the role model.
  roles: ['municipality_admin', 'platform_admin'],
  account: EVERYONE,
  // get_audit_log(): municipality admins of that municipality (and platform admins, who need
  // a municipality to be selected — not available without a membership yet).
  auditLog: ['municipality_admin'],
};

export function canAccessModule(role: AccessRole, module: ModuleId): boolean {
  return MODULE_ACCESS[module].includes(role);
}
