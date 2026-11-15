import { STAFF_ADMIN_MESSAGES } from '@smart-city/api';
import { messages } from '@smart-city/shared/i18n';
import { describe, expect, it } from 'vitest';

import {
  activeMembersByDepartment,
  canManageDepartments,
  canManageStaff,
  canSeeDepartmentReportCount,
  canViewFormerStaff,
  departmentDeactivationBlocked,
  filterDirectory,
  handoverCandidates,
  invitationActions,
  leavesDepartment,
  parseDirectoryFilters,
  type DirectoryEntry,
} from './capabilities';
import { MATRIX_ROLES, roleMatrix } from './role-matrix';

const d1 = '8b3c4d5e-2f3a-4b5c-9d0e-1f2a3b4c5d6e';
const d2 = '9b3c4d5e-2f3a-4b5c-9d0e-1f2a3b4c5d6e';

const entry = (over: Partial<DirectoryEntry>): DirectoryEntry => ({
  employeeId: 'e',
  fullName: 'Dana Levi',
  role: 'employee',
  departmentId: d1,
  jobTitle: null,
  isActive: true,
  createdAt: null,
  ...over,
});

describe('management permissions (mirror RLS and the admin-only RPCs)', () => {
  it('lets only municipality admins manage departments and staff, or see former staff', () => {
    for (const role of MATRIX_ROLES) {
      const admin = role === 'municipality_admin';
      expect(canManageDepartments(role)).toBe(admin);
      expect(canManageStaff(role)).toBe(admin);
      expect(canViewFormerStaff(role)).toBe(admin);
    }
  });

  it('shows department report counts only where the caller sees the reports', () => {
    expect(canSeeDepartmentReportCount('municipality_admin', null, d1)).toBe(true);
    expect(canSeeDepartmentReportCount('department_manager', d1, d1)).toBe(true);
    expect(canSeeDepartmentReportCount('department_manager', d1, d2)).toBe(false);
    expect(canSeeDepartmentReportCount('employee', d1, d1)).toBe(false);
  });

  it('blocks department deactivation while active staff remain (decision C)', () => {
    expect(departmentDeactivationBlocked(0)).toBe(false);
    expect(departmentDeactivationBlocked(2)).toBe(true);
  });

  it('offers revoke and re-invite per invitation state', () => {
    expect(invitationActions('pending')).toEqual({ revoke: true, reinvite: false });
    expect(invitationActions('expired')).toEqual({ revoke: true, reinvite: true });
    expect(invitationActions('revoked')).toEqual({ revoke: false, reinvite: true });
    expect(invitationActions('declined')).toEqual({ revoke: false, reinvite: true });
    expect(invitationActions('accepted')).toEqual({ revoke: false, reinvite: false });
  });
});

describe('directory', () => {
  const entries = [
    entry({ employeeId: 'a', fullName: 'Dana Levi', jobTitle: 'Inspector' }),
    entry({
      employeeId: 'b',
      fullName: 'Sami Haddad',
      role: 'department_manager',
      departmentId: d2,
    }),
    entry({
      employeeId: 'c',
      fullName: 'Noa',
      role: 'intake_dispatcher',
      departmentId: null,
      isActive: false,
    }),
    entry({ employeeId: 'd', fullName: null, jobTitle: 'Électricienne' }),
  ];

  it('parses filters strictly', () => {
    expect(
      parseDirectoryFilters({
        q: ' dana ',
        role: 'employee',
        department: d1.toUpperCase(),
        status: 'inactive',
      }),
    ).toEqual({
      search: 'dana',
      role: 'employee',
      department: d1,
      status: 'inactive',
    });
    expect(
      parseDirectoryFilters({ role: 'platform_admin', department: 'x', status: 'gone' }),
    ).toEqual({
      search: undefined,
      role: undefined,
      department: undefined,
      status: undefined,
    });
    expect(parseDirectoryFilters({ department: 'none' }).department).toBe('none');
  });

  it('filters by name or job title (accent-insensitive), role, department and status', () => {
    const ids = (filters: Parameters<typeof filterDirectory>[1]) =>
      filterDirectory(entries, filters).map((e) => e.employeeId);
    expect(ids({ search: 'DANA' })).toEqual(['a']);
    expect(ids({ search: 'electric' })).toEqual(['d']);
    expect(ids({ role: 'department_manager' })).toEqual(['b']);
    expect(ids({ department: 'none' })).toEqual(['c']);
    expect(ids({ department: d1 })).toEqual(['a', 'd']);
    expect(ids({ status: 'inactive' })).toEqual(['c']);
  });

  it('counts active members per department and finds handover candidates', () => {
    expect(activeMembersByDepartment(entries)).toEqual(
      new Map([
        [d1, 2],
        [d2, 1],
      ]),
    );
    expect(handoverCandidates(entries, d1, 'a').map((e) => e.employeeId)).toEqual(['d']);
    expect(handoverCandidates(entries, null, 'a')).toEqual([]);
  });

  it('knows when a change takes someone out of their department', () => {
    expect(
      leavesDepartment(
        { role: 'employee', departmentId: d1 },
        { role: 'department_manager', departmentId: d1 },
      ),
    ).toBe(false);
    expect(
      leavesDepartment(
        { role: 'employee', departmentId: d1 },
        { role: 'employee', departmentId: d2 },
      ),
    ).toBe(true);
    expect(
      leavesDepartment(
        { role: 'employee', departmentId: d1 },
        { role: 'municipality_admin', departmentId: null },
      ),
    ).toBe(true);
    expect(
      leavesDepartment(
        { role: 'intake_dispatcher', departmentId: null },
        { role: 'employee', departmentId: d1 },
      ),
    ).toBe(false);
  });
});

describe('roles matrix', () => {
  const matrix = roleMatrix();
  const find = (label: string) => matrix.flatMap((g) => g.rows).find((r) => r.label === label)!;

  it('reflects the real rules', () => {
    expect(find('adminRoles.rows.contact').cells.intake_dispatcher).toEqual({ kind: 'no' });
    expect(find('adminRoles.rows.contact').cells.employee).toEqual({ kind: 'yes' });
    expect(find('adminRoles.rows.assign').cells.employee).toEqual({ kind: 'no' });
    expect(find('adminRoles.rows.changeStatus').cells.intake_dispatcher).toEqual({
      kind: 'text',
      key: 'adminRoles.values.dispatcherTransitions',
    });
    expect(find('adminRoles.rows.reportScope').cells.platform_admin).toEqual({ kind: 'no' });
    expect(find('adminNav.roles').cells.platform_admin).toEqual({ kind: 'yes' });
    expect(find('adminRoles.rows.manageStaff').cells.department_manager).toEqual({ kind: 'no' });
  });

  it('has a cell for every role in every row', () => {
    for (const r of matrix.flatMap((g) => g.rows)) {
      expect(Object.keys(r.cells).sort()).toEqual([...MATRIX_ROLES].sort());
    }
  });
});

describe('staff messages', () => {
  it('explains every database refusal the API recognizes, in every language', () => {
    const issues = [...Object.keys(STAFF_ADMIN_MESSAGES), 'invitation_pending'];
    for (const locale of ['he', 'ar', 'en'] as const) {
      for (const issue of issues) {
        expect(
          (messages[locale].adminStaff.issues as Record<string, string>)[issue],
          `${locale}: ${issue}`,
        ).toBeTruthy();
      }
    }
  });
});
