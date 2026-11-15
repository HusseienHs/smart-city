import type { InvitationState, StaffColleague, StaffMember } from '@smart-city/api';
import { MUNICIPAL_STAFF_ROLES, type MunicipalStaffRole } from '@smart-city/shared';

import type { AccessRole } from '@/lib/auth/permissions';

/**
 * What the staff and department screens OFFER each role. User experience only: every action is
 * authorized again by its Server Action and finally by the database, which is the authority.
 */

/** Department insert/update RLS: municipality admins only. */
export function canManageDepartments(role: AccessRole): boolean {
  return role === 'municipality_admin';
}

/** Invitations, set_employee_role and employee updates: municipality admins only. */
export function canManageStaff(role: AccessRole): boolean {
  return role === 'municipality_admin';
}

/** get_municipality_staff (former staff with names): municipality admins only. */
export function canViewFormerStaff(role: AccessRole): boolean {
  return role === 'municipality_admin';
}

/**
 * Report counts per department are only meaningful where the caller can see the reports
 * (can_access_report): admins for every department, managers for their own.
 */
export function canSeeDepartmentReportCount(
  role: AccessRole,
  ownDepartmentId: string | null,
  departmentId: string,
): boolean {
  if (role === 'municipality_admin') return true;
  return role === 'department_manager' && ownDepartmentId === departmentId;
}

/** Decision C: a department with active staff can't be deactivated from the dashboard. */
export function departmentDeactivationBlocked(activeMembers: number): boolean {
  return activeMembers > 0;
}

/**
 * Invitation actions:
 * - revoke: pending ones, including expired ones (they still block a new invitation);
 * - invite again: expired, revoked or declined ones (expired = revoke + create).
 */
export function invitationActions(state: InvitationState): { revoke: boolean; reinvite: boolean } {
  return {
    revoke: state === 'pending' || state === 'expired',
    reinvite: state === 'expired' || state === 'revoked' || state === 'declined',
  };
}

// ---------------------------------------------------------------------------------------------
// Directory
// ---------------------------------------------------------------------------------------------

/** One row of the staff directory: admins get every member, others active colleagues. */
export interface DirectoryEntry {
  employeeId: string;
  fullName: string | null;
  role: MunicipalStaffRole;
  departmentId: string | null;
  jobTitle: string | null;
  isActive: boolean;
  /** Only known from get_municipality_staff (admins). */
  createdAt: string | null;
}

const isMunicipalRole = (role: string): role is MunicipalStaffRole =>
  (MUNICIPAL_STAFF_ROLES as readonly string[]).includes(role);

export function fromStaffMembers(members: readonly StaffMember[]): DirectoryEntry[] {
  return members
    .filter((m) => isMunicipalRole(m.role))
    .map((m) => ({
      employeeId: m.employee_id,
      fullName: m.full_name,
      role: m.role as MunicipalStaffRole,
      departmentId: m.department_id,
      jobTitle: m.job_title,
      isActive: m.is_active,
      createdAt: m.created_at,
    }));
}

export function fromColleagues(colleagues: readonly StaffColleague[]): DirectoryEntry[] {
  return colleagues
    .filter((c) => isMunicipalRole(c.role))
    .map((c) => ({
      employeeId: c.employee_id,
      fullName: c.full_name,
      role: c.role as MunicipalStaffRole,
      departmentId: c.department_id,
      jobTitle: c.job_title,
      isActive: true,
      createdAt: null,
    }));
}

export type StatusFilter = 'active' | 'inactive';

export interface DirectoryFilters {
  search?: string;
  role?: MunicipalStaffRole;
  /** A department id, or `none` for members without a department. */
  department?: string;
  status?: StatusFilter;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type SearchParams = Readonly<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export function parseDirectoryFilters(params: SearchParams): DirectoryFilters {
  const search = first(params.q)?.trim().slice(0, 100) || undefined;
  const roleValue = first(params.role);
  const role = roleValue && isMunicipalRole(roleValue) ? roleValue : undefined;
  const departmentValue = first(params.department);
  const department =
    departmentValue === 'none' || (departmentValue && UUID.test(departmentValue))
      ? departmentValue.toLowerCase()
      : undefined;
  const statusValue = first(params.status);
  const status = statusValue === 'active' || statusValue === 'inactive' ? statusValue : undefined;
  return { search, role, department, status };
}

/** Case- and accent-insensitive "contains" on name and job title. */
function matches(text: string | null, search: string): boolean {
  if (!text) return false;
  const normalize = (value: string) =>
    value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase();
  return normalize(text).includes(normalize(search));
}

export function filterDirectory(
  entries: readonly DirectoryEntry[],
  filters: DirectoryFilters,
): DirectoryEntry[] {
  return entries.filter((entry) => {
    if (filters.role && entry.role !== filters.role) return false;
    if (filters.department === 'none' && entry.departmentId !== null) return false;
    if (
      filters.department &&
      filters.department !== 'none' &&
      entry.departmentId !== filters.department
    ) {
      return false;
    }
    if (filters.status === 'active' && !entry.isActive) return false;
    if (filters.status === 'inactive' && entry.isActive) return false;
    if (
      filters.search &&
      !matches(entry.fullName, filters.search) &&
      !matches(entry.jobTitle, filters.search)
    ) {
      return false;
    }
    return true;
  });
}

/** Active members per department id. */
export function activeMembersByDepartment(entries: readonly DirectoryEntry[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (entry.isActive && entry.departmentId) {
      counts.set(entry.departmentId, (counts.get(entry.departmentId) ?? 0) + 1);
    }
  }
  return counts;
}

/** Active employees/managers of a department who could take over someone's open reports. */
export function handoverCandidates(
  entries: readonly DirectoryEntry[],
  departmentId: string | null,
  excludeEmployeeId: string,
): DirectoryEntry[] {
  if (!departmentId) return [];
  return entries.filter(
    (entry) =>
      entry.isActive &&
      entry.departmentId === departmentId &&
      entry.employeeId !== excludeEmployeeId &&
      (entry.role === 'employee' || entry.role === 'department_manager'),
  );
}

/** Whether a role/department change takes the employee out of their department (set_employee_role). */
export function leavesDepartment(
  current: { role: MunicipalStaffRole; departmentId: string | null },
  next: { role: MunicipalStaffRole; departmentId: string | null },
): boolean {
  return (
    current.departmentId !== null &&
    (next.departmentId !== current.departmentId ||
      !(next.role === 'employee' || next.role === 'department_manager'))
  );
}
