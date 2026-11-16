import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * Shared look for every dropdown in the dashboard (language, user, municipality). Behavior
 * stays with each component (see use-popover.ts); this only keeps them visually identical.
 */
export const menuPanelClasses = (
  align: 'start' | 'end' | 'stretch' = 'end',
  side: 'bottom' | 'top' = 'bottom',
) =>
  cn(
    'popover absolute z-40 animate-popover-in p-1',
    side === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2',
    align === 'start' && 'start-0',
    align === 'end' && 'end-0',
    align === 'stretch' && 'inset-x-0',
  );

export const menuItemClasses = (selected?: boolean) =>
  cn(
    'flex min-h-9 w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-start text-base',
    'transition-colors duration-100 focus-visible:outline-none focus-visible:bg-surface-muted',
    selected ? 'bg-primary-soft text-accent' : 'text-foreground hover:bg-surface-muted',
  );

/** A thin divider between groups of menu items. */
export function MenuSeparator() {
  return <div role="separator" className="-mx-1 my-1 h-px bg-border" />;
}

/** A small muted heading inside a menu. */
export function MenuLabel({ className, ...props }: ComponentProps<'p'>) {
  return (
    <p className={cn('px-2.5 pt-1.5 pb-1 text-2xs font-medium text-muted', className)} {...props} />
  );
}

/** Keyboard hint, e.g. ⌘K. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-xs border border-border bg-surface-muted px-1 font-sans text-2xs font-medium text-muted">
      {children}
    </kbd>
  );
}
