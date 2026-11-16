'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/cn';
import { stripLocale } from '@/lib/i18n/routing';
import { isPathInModule } from '@/lib/navigation';

import type { ShellNavItem, SidebarVariant } from './types';

/**
 * A module link on the ink sidebar. The active module is lit: a raised glass row, a teal
 * icon and a glowing bar at the sidebar's start edge.
 */
export function NavLink({ item, variant }: { item: ShellNavItem; variant: SidebarVariant }) {
  const pathname = usePathname();
  const active = isPathInModule(stripLocale(pathname), item.path);
  // The static sidebar can be an icon rail: labels become tooltips.
  const rail = variant === 'static';

  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex h-9 items-center gap-3 rounded-lg px-2.5 text-[13.5px] font-medium',
        'transition-[background-color,color,box-shadow] duration-150 ease-standard',
        'focus-visible:ring-2 focus-visible:ring-sidebar-accent/60 focus-visible:outline-none',
        rail && 'rail:mx-auto rail:size-11 rail:justify-center rail:px-0',
        active
          ? 'bg-sidebar-active text-sidebar-foreground shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06),0_1px_0_rgb(255_255_255/0.04)]'
          : 'text-sidebar-secondary hover:bg-sidebar-hover hover:text-sidebar-foreground',
      )}
    >
      {active ? (
        <span
          aria-hidden
          className={cn(
            'absolute -start-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-e-full bg-sidebar-accent',
            'shadow-[0_0_14px_2px_rgb(62_230_200/0.55)]',
            rail && 'rail:-start-3.5',
          )}
        />
      ) : null}
      <Icon
        name={item.icon}
        strokeWidth={active ? 2 : 1.75}
        className={cn(
          'size-[18px] transition-colors duration-150',
          active ? 'text-sidebar-accent' : 'text-sidebar-muted group-hover:text-sidebar-secondary',
        )}
      />
      <span className={cn('truncate', rail && 'rail:sr-only')}>{item.label}</span>
      {rail ? (
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute start-full top-1/2 z-50 ms-3 hidden -translate-y-1/2 rounded-md rail:block',
            'bg-surface-raised px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-foreground shadow-lg ring-1 ring-border',
            'opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-hover:delay-150 group-focus-visible:opacity-100',
          )}
        >
          {item.label}
        </span>
      ) : null}
    </Link>
  );
}
