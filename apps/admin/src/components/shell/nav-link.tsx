'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/cn';
import { stripLocale } from '@/lib/i18n/routing';
import { isPathInModule } from '@/lib/navigation';

import type { ShellNavItem, SidebarVariant } from './types';

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
        'group relative flex h-8 items-center gap-2.5 rounded-md px-2 text-base font-medium',
        'transition-[background-color,color,box-shadow] duration-150 ease-standard',
        'focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none',
        rail && 'rail:mx-auto rail:size-10 rail:justify-center rail:px-0',
        active
          ? 'bg-surface text-foreground shadow-xs ring-1 ring-border'
          : 'text-foreground-secondary hover:bg-sidebar-hover hover:text-foreground',
      )}
    >
      <Icon
        name={item.icon}
        className={cn(
          'size-[18px] transition-colors duration-150',
          active ? 'text-accent' : 'text-muted group-hover:text-foreground-secondary',
        )}
      />
      <span className={cn('truncate', rail && 'rail:sr-only')}>{item.label}</span>
      {rail ? (
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute start-full top-1/2 z-50 ms-3 hidden -translate-y-1/2 rounded-sm rail:block',
            'bg-foreground px-2 py-1 text-xs font-medium whitespace-nowrap text-background shadow-md',
            'opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-hover:delay-150 group-focus-visible:opacity-100',
          )}
        >
          {item.label}
        </span>
      ) : null}
    </Link>
  );
}
