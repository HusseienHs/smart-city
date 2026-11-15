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
  // The static sidebar is an icon rail below the xl breakpoint: labels become tooltips.
  const rail = variant === 'static';

  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex h-9 items-center gap-3 rounded-sm px-3 text-base font-medium',
        'transition-colors duration-150 ease-standard',
        rail && 'max-xl:justify-center max-xl:px-0',
        active
          ? 'bg-navy-active text-white'
          : 'text-navy-foreground hover:bg-navy-hover hover:text-white',
      )}
    >
      {active ? (
        <span
          className="absolute inset-y-2 start-0 w-[3px] rounded-full bg-navy-accent"
          aria-hidden
        />
      ) : null}
      <Icon
        name={item.icon}
        className={cn(
          'size-[18px] transition-colors duration-150',
          active ? 'text-navy-accent' : 'text-navy-muted group-hover:text-navy-foreground',
        )}
      />
      <span className={cn('truncate', rail && 'max-xl:sr-only')}>{item.label}</span>
      {rail ? (
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute start-full top-1/2 z-50 ms-3 -translate-y-1/2 rounded-sm',
            'bg-foreground px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-white shadow-md',
            'opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 xl:hidden',
          )}
        >
          {item.label}
        </span>
      ) : null}
    </Link>
  );
}
