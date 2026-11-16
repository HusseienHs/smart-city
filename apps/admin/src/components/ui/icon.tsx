import { cn } from '@/lib/cn';

/**
 * The dashboard icon set: 24×24 stroke icons drawn for this product (no icon dependency).
 * Each icon is a list of SVG path strings rendered with the current text color.
 */
const ICONS = {
  // Modules
  overview: [
    'M4 5a1 1 0 0 1 1-1h5v7H4z',
    'M14 4h5a1 1 0 0 1 1 1v3h-6z',
    'M14 12h6v7a1 1 0 0 1-1 1h-5z',
    'M4 15h6v5H5a1 1 0 0 1-1-1z',
  ],
  reports: [
    'M9 3.5h6v3H9z',
    'M9 5H6.5a1 1 0 0 0-1 1v13.5a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H15',
    'M9 11h6',
    'M9 15h4',
  ],
  map: ['M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6z', 'M9 4v14', 'M15 6v14'],
  notices: ['M4 10v4a1 1 0 0 0 1 1h2l6 4V5L7 9H5a1 1 0 0 0-1 1z', 'M17 9a3.5 3.5 0 0 1 0 6'],
  events: [
    'M4.5 6.5a1 1 0 0 1 1-1h13a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1z',
    'M8 3.5v4',
    'M16 3.5v4',
    'M4.5 10h15',
    'M8 14h3',
  ],
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

  // Interface
  menu: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
  close: ['M6 6l12 12', 'M18 6 6 18'],
  chevronEnd: ['M9 6l6 6-6 6'],
  chevronStart: ['M15 6l-6 6 6 6'],
  chevronDown: ['M6 9l6 6 6-6'],
  chevronUp: ['M6 15l6-6 6 6'],
  chevronsUpDown: ['M8 9l4-4 4 4', 'M8 15l4 4 4-4'],
  arrowStart: ['M19 12H5', 'M11 6l-6 6 6 6'],
  arrowEnd: ['M5 12h14', 'M13 6l6 6-6 6'],
  arrowUp: ['M12 19V5', 'M6 11l6-6 6 6'],
  arrowDown: ['M12 5v14', 'M6 13l6 6 6-6'],
  sidebar: [
    'M4 5.5a1.5 1.5 0 0 1 1.5-1.5h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z',
    'M9.5 4v16',
  ],
  more: ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'],
  language: [
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
    'M3 12h18',
    'M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9',
    'M12 3C9.5 5.5 8.2 8.5 8.2 12s1.3 6.5 3.8 9',
  ],
  sun: [
    'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M12 2.5v2',
    'M12 19.5v2',
    'M4.6 4.6 6 6',
    'M18 18l1.4 1.4',
    'M2.5 12h2',
    'M19.5 12h2',
    'M4.6 19.4 6 18',
    'M18 6l1.4-1.4',
  ],
  moon: ['M20.5 14.1A8.5 8.5 0 1 1 9.9 3.5a6.8 6.8 0 0 0 10.6 10.6z'],
  search: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'M20 20l-4-4'],
  check: ['M5 12.5l4.5 4.5L19 7'],
  checkCircle: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M8.5 12.5l2.5 2.5 4.5-5'],
  minus: ['M6 12h12'],
  info: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 11v5', 'M12 8h.01'],
  alert: [
    'M10.3 4.3 2.9 17.5A2 2 0 0 0 4.6 20.5h14.8a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z',
    'M12 10v4',
    'M12 17h.01',
  ],
  clock: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7v5l3 2'],
  plus: ['M12 5v14', 'M5 12h14'],
  signOut: ['M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4', 'M10 16l-4-4 4-4', 'M6 12h10'],
  mail: [
    'M4 6.5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z',
    'M4.5 7l7.5 6 7.5-6',
  ],
  phone: [
    'M5 4h3.5l1.5 4.5-2 1.5a11 11 0 0 0 6 6l1.5-2 4.5 1.5V19a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z',
  ],
  filter: ['M4 5h16l-6 7.5V19l-4-2v-4.5z'],
  construction: ['M4 20h16', 'M6 20V9l6-5 6 5v11', 'M10 20v-5h4v5'],
  user: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4.5 20a7.5 7.5 0 0 1 15 0'],
  userPlus: [
    'M10 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M3 20a7 7 0 0 1 12.5-4.3',
    'M19 14v6',
    'M16 17h6',
  ],
  mapPin: [
    'M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.8 12 21 12 21z',
    'M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  ],
  tag: [
    'M3.5 12.1V4.5a1 1 0 0 1 1-1h7.6l8.4 8.4a1 1 0 0 1 0 1.4l-7.2 7.2a1 1 0 0 1-1.4 0z',
    'M8 8h.01',
  ],
  flag: ['M5 21V4', 'M5 4h11l-2 4 2 4H5'],
  message: ['M4 5.5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4z'],
  image: [
    'M4 5.5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z',
    'M9 10.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
    'M20 15l-5-5-9 9.5',
  ],
  upload: ['M12 15V4', 'M7 9l5-5 5 5', 'M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4'],
  edit: ['M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z', 'M14 8l2 2'],
  trash: ['M4 7h16', 'M9 7V4.5h6V7', 'M6 7l1 13h10l1-13', 'M10 11v5', 'M14 11v5'],
  archive: ['M3.5 5h17v4h-17z', 'M5 9v10h14V9', 'M10 13h4'],
  copy: ['M8 8h11v12H8z', 'M16 8V4H5v12h3'],
  link: [
    'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1',
    'M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  ],
  eye: [
    'M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z',
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  ],
  lock: ['M5.5 11h13v9.5h-13z', 'M8 11V7.5a4 4 0 0 1 8 0V11'],
  key: ['M14.5 14a5 5 0 1 0-4.6-3L3.5 17.5v3h3v-2h2v-2h2l1.6-1.6a5 5 0 0 0 2.4-.9z', 'M16 8h.01'],
  send: ['M20.5 3.5 10 14', 'M20.5 3.5 14 20.5l-4-6.5-6.5-4z'],
  inbox: ['M3.5 13h5l1.5 2.5h4l1.5-2.5h5', 'M5.5 5h13l2 8v6a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-6z'],
  layers: ['M12 3.5 3 8l9 4.5L21 8z', 'M3 12.5 12 17l9-4.5', 'M3 16.5 12 21l9-4.5'],
  sparkle: ['M12 3.5l1.9 5.6 5.6 1.9-5.6 1.9L12 18.5l-1.9-5.6L4.5 11l5.6-1.9z'],
  circle: ['M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16z'],
} as const satisfies Record<string, readonly string[]>;

export type IconName = keyof typeof ICONS;

/** Icons that point in the reading direction and must mirror in right-to-left layouts. */
const DIRECTIONAL: ReadonlySet<IconName> = new Set([
  'chevronEnd',
  'chevronStart',
  'arrowStart',
  'arrowEnd',
  'signOut',
  'sidebar',
  'send',
]);

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
