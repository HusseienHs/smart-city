import type { MessageKey } from '@smart-city/shared/i18n';

import type { IconName } from '@/components/ui/icon';

/**
 * The dashboard's information architecture: three groups, twelve top-level modules.
 * The single source for the sidebar, breadcrumbs, page titles and module placeholders.
 *
 * Role-based visibility is added with staff access in Phase 2.2. It will hide what a role
 * cannot use; the database (RLS) remains the authority on what data anyone can see.
 */

export type ModuleId =
  | 'overview'
  | 'reports'
  | 'map'
  | 'notices'
  | 'events'
  | 'employees'
  | 'departments'
  | 'analytics'
  | 'settings'
  | 'roles'
  | 'account'
  | 'auditLog';

export type NavGroupId = 'workspace' | 'organization' | 'configuration';

export interface NavModule {
  id: ModuleId;
  /** Path without the locale prefix. */
  path: string;
  label: MessageKey;
  icon: IconName;
  /** The roadmap phase that delivers the module. */
  phase: string;
  /** True when the module needs database/API work that does not exist yet. */
  requiresBackend?: boolean;
}

export interface NavGroup {
  id: NavGroupId;
  label: MessageKey;
  modules: readonly NavModule[];
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: 'workspace',
    label: 'adminNav.groups.workspace',
    modules: [
      { id: 'overview', path: '/', label: 'adminNav.overview', icon: 'overview', phase: '2.8' },
      { id: 'reports', path: '/reports', label: 'adminNav.reports', icon: 'reports', phase: '2.3' },
      { id: 'map', path: '/map', label: 'adminNav.map', icon: 'map', phase: '2.8' },
      { id: 'notices', path: '/notices', label: 'adminNav.notices', icon: 'notices', phase: '2.6' },
      {
        id: 'events',
        path: '/events',
        label: 'adminNav.events',
        icon: 'events',
        phase: '2.9',
        requiresBackend: true,
      },
    ],
  },
  {
    id: 'organization',
    label: 'adminNav.groups.organization',
    modules: [
      {
        id: 'employees',
        path: '/employees',
        label: 'adminNav.employees',
        icon: 'employees',
        phase: '2.5',
      },
      {
        id: 'departments',
        path: '/departments',
        label: 'adminNav.departments',
        icon: 'departments',
        phase: '2.5',
      },
      {
        id: 'analytics',
        path: '/analytics',
        label: 'adminNav.analytics',
        icon: 'analytics',
        phase: '2.9',
        requiresBackend: true,
      },
    ],
  },
  {
    id: 'configuration',
    label: 'adminNav.groups.configuration',
    modules: [
      {
        id: 'settings',
        path: '/settings',
        label: 'adminNav.settings',
        icon: 'settings',
        phase: '2.7',
      },
      { id: 'roles', path: '/roles', label: 'adminNav.roles', icon: 'roles', phase: '2.5' },
      { id: 'account', path: '/account', label: 'adminNav.account', icon: 'account', phase: '2.7' },
      {
        id: 'auditLog',
        path: '/audit-log',
        label: 'adminNav.auditLog',
        icon: 'auditLog',
        phase: '2.7',
      },
    ],
  },
];

export const NAV_MODULES: readonly NavModule[] = NAV_GROUPS.flatMap((group) => group.modules);

export function getModule(id: ModuleId): NavModule {
  const found = NAV_MODULES.find((entry) => entry.id === id);
  if (!found) throw new Error(`Unknown dashboard module: ${id}`);
  return found;
}

export function getModuleGroup(id: ModuleId): NavGroup {
  const found = NAV_GROUPS.find((group) => group.modules.some((entry) => entry.id === id));
  if (!found) throw new Error(`Dashboard module without a group: ${id}`);
  return found;
}

/** The description of a module, shown under its page title. */
export function moduleDescriptionKey(id: ModuleId): MessageKey {
  return id === 'overview' ? 'adminOverview.subtitle' : `adminModules.${id}`;
}

/** Whether `path` (no locale prefix) is the module's page or one of its sub-pages. */
export function isPathInModule(path: string, modulePath: string): boolean {
  if (modulePath === '/') return path === '/';
  return path === modulePath || path.startsWith(`${modulePath}/`);
}

/** The module that `path` (no locale prefix) belongs to, if any. */
export function moduleForPath(path: string): NavModule | undefined {
  return NAV_MODULES.find((entry) => isPathInModule(path, entry.path));
}
