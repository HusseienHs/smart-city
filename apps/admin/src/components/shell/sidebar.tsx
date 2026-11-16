import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { BrandMark } from './brand-mark';
import { NavLink } from './nav-link';
import { SidebarToggle } from './sidebar-toggle';
import type { ShellNavGroup, SidebarVariant } from './types';

export interface SidebarProps {
  groups: readonly ShellNavGroup[];
  productName: string;
  tagline: string;
  navLabel: string;
  backendConnected: boolean;
  backendLabel: string;
  versionLabel: string;
  collapseLabels: { collapse: string; expand: string };
  /**
   * The working context under the brand: municipality, role and the switcher. Receives
   * whether it is rendered in the icon rail.
   */
  context?: (rail: boolean) => ReactNode;
  /** The signed-in user at the bottom (opens the account menu). */
  user?: (rail: boolean) => ReactNode;
}

/**
 * The ink navigation sidebar. `static` is the persistent one: full width on desktop, an icon
 * rail on tablets and when collapsed (the `rail:` variant). `drawer` is the full sidebar
 * inside the off-canvas drawer on phones and tablets.
 */
export function Sidebar({
  variant,
  groups,
  productName,
  tagline,
  navLabel,
  backendConnected,
  backendLabel,
  versionLabel,
  collapseLabels,
  context,
  user,
}: SidebarProps & { variant: SidebarVariant }) {
  const rail = variant === 'static';
  // Only the persistent sidebar collapses; the drawer always shows labels.
  const railHidden = rail ? 'rail:sr-only' : undefined;

  return (
    <aside
      className={cn(
        'relative isolate flex h-full flex-col overflow-hidden bg-sidebar text-sidebar-foreground',
        rail
          ? 'w-(--sidebar-width) transition-[width] duration-200 ease-standard rail:w-(--sidebar-rail-width) rail:overflow-visible'
          : 'w-[min(296px,86vw)]',
      )}
    >
      {/* A faint teal aurora behind the brand. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -start-16 -top-24 -z-10 size-72 rounded-full bg-[radial-gradient(circle,rgb(45_212_191/0.16),transparent_65%)]"
      />

      {/* Brand */}
      <div
        className={cn(
          'flex h-(--header-height) shrink-0 items-center gap-3 px-4 pt-2',
          rail && 'rail:justify-center rail:px-0',
        )}
      >
        <BrandMark />
        <div className={cn('min-w-0 flex-1 leading-tight', railHidden)}>
          <p className="truncate text-[15px] font-semibold tracking-tight text-sidebar-foreground">
            {productName}
          </p>
          <p className="truncate text-2xs text-sidebar-muted">{tagline}</p>
        </div>
        {rail ? (
          <div className="max-xl:hidden rail:hidden">
            <SidebarToggle labels={collapseLabels} />
          </div>
        ) : null}
      </div>

      {/* Municipality */}
      {context ? (
        <div className={cn('shrink-0 px-3 pt-3 pb-2', rail && 'rail:px-3.5')}>{context(rail)}</div>
      ) : null}

      {/* Modules */}
      <nav
        aria-label={navLabel}
        className={cn(
          'flex-1 scrollbar-thin [scrollbar-color:rgb(255_255_255/0.12)_transparent] px-3 pt-3 pb-4',
          // Tooltips of the rail extend past its edge, so the rail must not clip them.
          rail ? 'overflow-y-auto rail:overflow-visible rail:px-3.5' : 'overflow-y-auto',
        )}
      >
        {groups.map((group, index) => {
          const headingId = `nav-${variant}-${group.id}`;
          return (
            <div
              key={group.id}
              role="group"
              aria-labelledby={headingId}
              className={cn(index > 0 && 'mt-6', rail && index > 0 && 'rail:mt-3')}
            >
              {rail && index > 0 ? (
                <div
                  className="mx-2 mb-3 hidden border-t border-sidebar-border rail:block"
                  aria-hidden
                />
              ) : null}
              <p
                id={headingId}
                className={cn('mb-2 px-2.5 eyebrow text-sidebar-subtle', railHidden)}
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

      {/* Footer: system status, collapse control (rail), signed-in user */}
      <div className={cn('shrink-0 space-y-2 p-3', rail && 'rail:px-3.5')}>
        <div
          className={cn(
            'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-2xs text-sidebar-muted',
            rail && 'rail:justify-center rail:px-0',
          )}
          title={backendLabel}
        >
          <span className="relative flex size-2 shrink-0" aria-hidden>
            {backendConnected ? (
              <span className="absolute inset-0 animate-ping rounded-full bg-sidebar-accent opacity-50 [animation-duration:2.5s]" />
            ) : null}
            <span
              className={cn(
                'relative size-2 rounded-full',
                backendConnected
                  ? 'bg-sidebar-accent shadow-[0_0_8px_rgb(62_230_200/0.8)]'
                  : 'bg-sidebar-subtle',
              )}
            />
          </span>
          <span className={cn('min-w-0 flex-1 truncate', railHidden)}>{backendLabel}</span>
          <span
            className={cn(
              'shrink-0 rounded-full bg-sidebar-raised px-2 text-[10px] leading-4 text-sidebar-muted tabular-nums ring-1 ring-sidebar-border',
              railHidden,
            )}
          >
            {versionLabel}
          </span>
        </div>
        {rail ? (
          <div className="hidden justify-center xl:rail:flex">
            <SidebarToggle labels={collapseLabels} />
          </div>
        ) : null}
        {user ? user(rail) : null}
      </div>
    </aside>
  );
}
