import { MUNICIPAL_STAFF_ROLES } from '@smart-city/shared';
import type { MessageKey } from '@smart-city/shared/i18n';

import { canAccessModule, type AccessRole } from '@/lib/auth/permissions';
import { NAV_MODULES } from '@/lib/navigation';
import {
  assignmentMode,
  canViewReporterContact,
  completionUpload,
  statusTargets,
} from '@/lib/reports/capabilities';

import { canManageDepartments, canManageStaff, canViewFormerStaff } from './capabilities';

/**
 * The Roles & Permissions matrix, computed from the same rules the dashboard uses everywhere
 * (which in turn mirror the database). Nothing here is a separate source of truth.
 */

export const MATRIX_ROLES: readonly AccessRole[] = [...MUNICIPAL_STAFF_ROLES, 'platform_admin'];

/** A cell: yes/no, or a short explanation. */
export type MatrixCell = { kind: 'yes' } | { kind: 'no' } | { kind: 'text'; key: MessageKey };

export interface MatrixRow {
  label: MessageKey;
  cells: Readonly<Record<AccessRole, MatrixCell>>;
}

export interface MatrixGroup {
  label: MessageKey;
  rows: MatrixRow[];
}

const yesNo = (value: boolean): MatrixCell => (value ? { kind: 'yes' } : { kind: 'no' });
const text = (key: MessageKey): MatrixCell => ({ kind: 'text', key });

const row = (label: MessageKey, cell: (role: AccessRole) => MatrixCell): MatrixRow => ({
  label,
  cells: Object.fromEntries(MATRIX_ROLES.map((role) => [role, cell(role)])) as Record<
    AccessRole,
    MatrixCell
  >,
});

/** "Can this role change some status?" — a routed report in review offers every role's edges. */
function statusCell(role: AccessRole): MatrixCell {
  const targets = statusTargets(role, { status: 'under_review', department_id: 'routed' });
  if (targets.length === 0) return { kind: 'no' };
  return role === 'intake_dispatcher'
    ? text('adminRoles.values.dispatcherTransitions')
    : text('adminRoles.values.allTransitions');
}

function assignCell(role: AccessRole): MatrixCell {
  switch (assignmentMode(role)) {
    case 'full':
      return text('adminRoles.values.assignFull');
    case 'department':
      return text('adminRoles.values.assignDepartment');
    case 'route':
      return text('adminRoles.values.assignRoute');
    default:
      return { kind: 'no' };
  }
}

function scopeCell(role: AccessRole): MatrixCell {
  switch (role) {
    case 'municipality_admin':
      return text('adminRoles.values.scopeAdmin');
    case 'department_manager':
      return text('adminRoles.values.scopeManager');
    case 'employee':
      return text('adminRoles.values.scopeEmployee');
    case 'intake_dispatcher':
      return text('adminRoles.values.scopeDispatcher');
    default:
      return { kind: 'no' };
  }
}

export function roleMatrix(): MatrixGroup[] {
  return [
    {
      label: 'adminRoles.groups.modules',
      rows: NAV_MODULES.filter((module) => module.id !== 'overview' && module.id !== 'account').map(
        (module) => row(module.label, (role) => yesNo(canAccessModule(role, module.id))),
      ),
    },
    {
      label: 'adminRoles.groups.reports',
      rows: [
        row('adminRoles.rows.reportScope', scopeCell),
        row('adminRoles.rows.changeStatus', statusCell),
        row('adminRoles.rows.assign', assignCell),
        row('adminRoles.rows.comment', (role) => yesNo(canAccessModule(role, 'reports'))),
        row('adminRoles.rows.contact', (role) => yesNo(canViewReporterContact(role))),
        row('adminRoles.rows.completion', (role) =>
          yesNo(completionUpload(role, 'in_progress', 0).allowed),
        ),
      ],
    },
    {
      label: 'adminRoles.groups.staff',
      rows: [
        row('adminRoles.rows.manageDepartments', (role) => yesNo(canManageDepartments(role))),
        row('adminRoles.rows.manageStaff', (role) => yesNo(canManageStaff(role))),
        row('adminRoles.rows.inactiveStaff', (role) => yesNo(canViewFormerStaff(role))),
      ],
    },
  ];
}
