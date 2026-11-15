import { SUPPORTED_LOCALES } from '@smart-city/shared';
import { translate } from '@smart-city/shared/i18n';
import { describe, expect, it } from 'vitest';

import {
  getModule,
  getModuleGroup,
  isPathInModule,
  moduleDescriptionKey,
  moduleForPath,
  NAV_GROUPS,
  NAV_MODULES,
} from './navigation';

describe('navigation structure', () => {
  it('has the three groups and twelve modules of the product specification, in order', () => {
    expect(NAV_GROUPS.map((group) => group.id)).toEqual([
      'workspace',
      'organization',
      'configuration',
    ]);
    expect(NAV_GROUPS.map((group) => group.modules.map((entry) => entry.id))).toEqual([
      ['overview', 'reports', 'map', 'notices', 'events'],
      ['employees', 'departments', 'analytics'],
      ['settings', 'roles', 'account', 'auditLog'],
    ]);
  });

  it('has unique ids and paths', () => {
    const ids = NAV_MODULES.map((entry) => entry.id);
    const paths = NAV_MODULES.map((entry) => entry.path);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of paths) expect(path).toMatch(/^\/([a-z]+(-[a-z]+)*)?$/);
  });

  it('marks the modules that wait for backend work', () => {
    const waiting = NAV_MODULES.filter((entry) => entry.requiresBackend).map((m) => m.id);
    expect(waiting).toEqual(['events', 'analytics']);
  });

  it('finds modules and their groups', () => {
    expect(getModule('notices').path).toBe('/notices');
    expect(getModuleGroup('roles').id).toBe('configuration');
    expect(() => getModule('nope' as never)).toThrow();
  });
});

describe('translations', () => {
  it('labels and describes every group and module in Hebrew, Arabic and English', () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const group of NAV_GROUPS) {
        expect(translate(locale, group.label)).not.toBe(group.label);
        for (const entry of group.modules) {
          expect(translate(locale, entry.label)).not.toBe(entry.label);
          const description = moduleDescriptionKey(entry.id);
          expect(translate(locale, description)).not.toBe(description);
        }
      }
    }
  });

  it('uses distinct labels within each language', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const labels = NAV_MODULES.map((entry) => translate(locale, entry.label));
      expect(new Set(labels).size).toBe(labels.length);
    }
  });
});

describe('active module', () => {
  it('matches a module and its sub-pages, never a sibling prefix', () => {
    expect(isPathInModule('/reports', '/reports')).toBe(true);
    expect(isPathInModule('/reports/123', '/reports')).toBe(true);
    expect(isPathInModule('/reports-archive', '/reports')).toBe(false);
  });

  it('matches Overview only on the dashboard root', () => {
    expect(isPathInModule('/', '/')).toBe(true);
    expect(isPathInModule('/reports', '/')).toBe(false);
  });

  it('resolves the module of a path', () => {
    expect(moduleForPath('/')?.id).toBe('overview');
    expect(moduleForPath('/audit-log')?.id).toBe('auditLog');
    expect(moduleForPath('/employees/42')?.id).toBe('employees');
    expect(moduleForPath('/design-system')).toBeUndefined();
  });
});
