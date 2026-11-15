import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { BrandMark } from './brand-mark';
import { NavLink } from './nav-link';
import type { ShellNavGroup, SidebarVariant } from './types';

export interface SidebarProps {
  groups: readonly ShellNavGroup[];
  productName: string;
  tagline: string;
  navLabel: string;
  backendConnected: boolean;
  backendLabel: string;
  versionLabel: string;
  /** The working context under the brand: municipality, role and the switcher. */
  context?: ReactNode;
}

export function Sidebar({
  variant,
  groups,
  productName,
  tagline,
  navLabel,
  backendConnected,
  backendLabel,
  versionLabel,
  context,
}: SidebarProps & { variant: SidebarVariant }) {
  const rail = variant === 'static';
  // Only labels of the rail collapse; the drawer always shows the full sidebar.
  const railHidden = rail ? 'max-xl:sr-only' : undefined;

  return (
    <aside
      className={cn(
        'flex h-full flex-col bg-navy text-navy-foreground',
        rail ? 'w-(--sidebar-rail-width) xl:w-(--sidebar-width)' : 'w-[min(280px,85vw)]',
      )}
    >
      <div
        className={cn(
          'flex h-(--header-height) shrink-0 items-center gap-3 border-b border-navy-border px-4',
          rail && 'max-xl:justify-center',
        )}
      >
        <BrandMark />
        <div className={cn('min-w-0', railHidden)}>
          <p className="truncate text-md leading-5 font-semibold text-white">{productName}</p>
          <p className="truncate text-xs text-navy-muted">{tagline}</p>
        </div>
      </div>

      {context ? (
        // In the icon rail the context is reachable through the drawer instead.
        <div className={cn('shrink-0 border-b border-navy-border p-3', rail && 'max-xl:hidden')}>
          {context}
        </div>
      ) : null}

      <nav
        aria-label={navLabel}
        className={cn(
          'flex-1 scrollbar-thin px-3 py-4',
          // Tooltips of the rail extend past its edge, so the rail must not clip them.
          rail ? 'max-xl:overflow-visible xl:overflow-y-auto' : 'overflow-y-auto',
        )}
      >
        {groups.map((group, index) => {
          const headingId = `nav-${variant}-${group.id}`;
          return (
            <div
              key={group.id}
              role="group"
              aria-labelledby={headingId}
              className={cn(index > 0 && (rail ? 'mt-3 xl:mt-6' : 'mt-6'))}
            >
              {rail && index > 0 ? (
                <div className="mx-2 mb-3 border-t border-navy-border xl:hidden" aria-hidden />
              ) : null}
              <p
                id={headingId}
                className={cn(
                  'mb-2 px-3 text-[11px] font-semibold tracking-wider text-navy-muted uppercase',
                  railHidden,
                )}
              >
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <NavLink item={item} variant={variant} />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      <div
        className={cn('shrink-0 border-t border-navy-border px-4 py-3', rail && 'max-xl:px-0')}
        title={rail ? backendLabel : undefined}
      >
        <p className={cn('flex items-start gap-2 text-xs', rail && 'max-xl:justify-center')}>
          <span
            className={cn(
              'mt-1 size-2 shrink-0 rounded-full',
              backendConnected ? 'bg-navy-success' : 'bg-navy-muted',
            )}
            aria-hidden
          />
          <span className={cn('line-clamp-2', railHidden)}>{backendLabel}</span>
        </p>
        <p className={cn('mt-1 text-[11px] text-navy-muted tabular-nums', railHidden)}>
          {versionLabel}
        </p>
      </div>
    </aside>
  );
}
