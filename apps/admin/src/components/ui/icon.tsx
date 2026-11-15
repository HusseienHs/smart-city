import { cn } from '@/lib/cn';

/**
 * The dashboard icon set: 24×24 stroke icons drawn for this product (no icon dependency).
 * Each icon is a list of SVG path strings rendered with the current text color.
 */
const ICONS = {
  overview: ['M4 4h7v7H4z', 'M13 4h7v4h-7z', 'M13 10h7v10h-7z', 'M4 13h7v7H4z'],
  reports: ['M9 3.5h6v3H9z', 'M9 5H6v15.5h12V5h-3', 'M9 11h6', 'M9 15h4'],
  map: ['M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z', 'M9 4v14', 'M15 6v14'],
  notices: ['M4 10v4a1 1 0 0 0 1 1h2l6 4V5L7 9H5a1 1 0 0 0-1 1z', 'M17 9a3.5 3.5 0 0 1 0 6'],
  events: ['M4 6h16v14H4z', 'M8 3v4', 'M16 3v4', 'M4 10h16', 'M8 14h3'],
  employees: [
    'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'M3 20a6 6 0 0 1 12 0',
    'M16 5.2a3 3 0 0 1 0 5.6',
    'M18 14.5a6 6 0 0 1 3 5.5',
  ],
  departments: [
    'M4 21V6l8-3 8 3v15',
    'M2.5 21h19',
    'M10 21v-4h4v4',
    'M9 9h.01',
    'M15 9h.01',
    'M9 13h.01',
    'M15 13h.01',
  ],
  analytics: ['M4 20h16', 'M7 16v-5', 'M12 16V7', 'M17 16v-8'],
  settings: [
    'M4 7h9',
    'M17 7h3',
    'M4 17h3',
    'M11 17h9',
    'M17 7a2 2 0 1 1-4 0 2 2 0 0 1 4 0z',
    'M11 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0z',
  ],
  roles: ['M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z', 'M9 12l2 2 4-4'],
  account: [
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
    'M12 12.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'M6.5 18.5a6.5 6.5 0 0 1 11 0',
  ],
  auditLog: ['M3.5 12a8.5 8.5 0 1 0 2.5-6', 'M3.5 4v4h4', 'M12 8v4l3 2'],
  menu: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
  close: ['M6 6l12 12', 'M18 6 6 18'],
  chevronEnd: ['M9 6l6 6-6 6'],
  chevronDown: ['M6 9l6 6 6-6'],
  language: [
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
    'M3 12h18',
    'M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9',
    'M12 3C9.5 5.5 8.2 8.5 8.2 12s1.3 6.5 3.8 9',
  ],
  search: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'M20 20l-4-4'],
  check: ['M5 12.5l4.5 4.5L19 7'],
  info: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 11v5', 'M12 8h.01'],
  alert: ['M12 4 2.8 19.5h18.4z', 'M12 10v4', 'M12 17h.01'],
  clock: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7v5l3 2'],
  plus: ['M12 5v14', 'M5 12h14'],
  signOut: ['M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4', 'M10 16l-4-4 4-4', 'M6 12h10'],
  mail: ['M4 6h16v12H4z', 'M4 7l8 6 8-6'],
  filter: ['M4 5h16l-6 7.5V19l-4-2v-4.5z'],
  construction: ['M4 20h16', 'M6 20V9l6-5 6 5v11', 'M10 20v-5h4v5'],
} as const satisfies Record<string, readonly string[]>;

export type IconName = keyof typeof ICONS;

/** Icons that point in the reading direction and must mirror in right-to-left layouts. */
const DIRECTIONAL: ReadonlySet<IconName> = new Set(['chevronEnd', 'signOut']);

interface IconProps {
  name: IconName;
  className?: string;
  /** Visible to assistive technology only when given; decorative otherwise. */
  label?: string;
  strokeWidth?: number;
}

export function Icon({ name, className, label, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-5 shrink-0', DIRECTIONAL.has(name) && 'rtl:-scale-x-100', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {ICONS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
