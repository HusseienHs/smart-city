import { MUNICIPAL_STAFF_ROLES } from '@smart-city/shared';
import { describe, expect, it } from 'vitest';

import { NAV_MODULES } from '@/lib/navigation';

import { canAccessModule, MODULE_ACCESS, type AccessRole } from './permissions';

const visible = (role: AccessRole) =>
  NAV_MODULES.filter((entry) => canAccessModule(role, entry.id)).map((entry) => entry.id);

describe('module access by role', () => {
  it('covers every module', () => {
    expect(Object.keys(MODULE_ACCESS).sort()).toEqual(NAV_MODULES.map((m) => m.id).sort());
  });

  it('municipality admins see every module', () => {
    expect(visible('municipality_admin')).toEqual(NAV_MODULES.map((entry) => entry.id));
  });

  it('department managers: no municipality settings, roles or audit log', () => {
    expect(visible('department_manager')).toEqual([
      'overview',
      'reports',
      'map',
      'notices',
      'events',
      'employees',
      'departments',
      'analytics',
      'account',
    ]);
  });

  it('intake dispatchers: reports work, never content (can_draft_content excludes them)', () => {
    expect(visible('intake_dispatcher')).toEqual([
      'overview',
      'reports',
      'map',
      'employees',
      'account',
    ]);
  });

  it('employees: their reports, drafting notices for their department, colleagues', () => {
    expect(visible('employee')).toEqual([
      'overview',
      'reports',
      'map',
      'notices',
      'employees',
      'account',
    ]);
  });

  it('platform admins never see report modules (no report access in the database)', () => {
    expect(visible('platform_admin')).toEqual(['overview', 'roles', 'account']);
    expect(canAccessModule('platform_admin', 'reports')).toBe(false);
    expect(canAccessModule('platform_admin', 'map')).toBe(false);
  });

  it('settings, roles and the audit log are municipality-admin only among municipal roles', () => {
    for (const role of MUNICIPAL_STAFF_ROLES) {
      const admin = role === 'municipality_admin';
      expect(canAccessModule(role, 'settings')).toBe(admin);
      expect(canAccessModule(role, 'roles')).toBe(admin);
      expect(canAccessModule(role, 'auditLog')).toBe(admin);
    }
  });

  it('everyone reaches the overview and their own account', () => {
    for (const role of [...MUNICIPAL_STAFF_ROLES, 'platform_admin'] as const) {
      expect(canAccessModule(role, 'overview')).toBe(true);
      expect(canAccessModule(role, 'account')).toBe(true);
    }
  });
});
