import type { MessageKey } from '@smart-city/shared/i18n';

export interface NavItem {
  href: string;
  label: MessageKey;
  /** SVG path data (24×24 viewBox, stroke icons). */
  icon: string;
}

export const ADMIN_NAV: readonly NavItem[] = [
  { href: '/', label: 'adminNav.overview', icon: 'M3 12l9-9 9 9M5 10v10h14V10' },
  { href: '/reports', label: 'adminNav.reports', icon: 'M9 5h6M9 3h6v4H9zM5 5h2v16h10V5h2v16H5z' },
  { href: '/map', label: 'adminNav.map', icon: 'M9 4l6 2 6-2v14l-6 2-6-2-6 2V6zM9 4v14M15 6v14' },
  { href: '/departments', label: 'adminNav.departments', icon: 'M4 21V5l8-3 8 3v16M9 21v-5h6v5' },
  {
    href: '/employees',
    label: 'adminNav.employees',
    icon: 'M16 19a4 4 0 00-8 0M12 11a3 3 0 100-6 3 3 0 000 6',
  },
  {
    href: '/announcements',
    label: 'adminNav.announcements',
    icon: 'M4 10v4h3l6 4V6L7 10zM17 9a3 3 0 010 6',
  },
  { href: '/events', label: 'adminNav.events', icon: 'M4 6h16v14H4zM8 3v4M16 3v4M4 10h16' },
  { href: '/analytics', label: 'adminNav.analytics', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  {
    href: '/settings',
    label: 'adminNav.settings',
    icon: 'M12 15a3 3 0 100-6 3 3 0 000 6zM4 12h2M18 12h2M12 4v2M12 18v2',
  },
];
