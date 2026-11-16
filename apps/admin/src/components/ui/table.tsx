import type { ComponentProps } from 'react';

import { cn } from '@/lib/cn';

/**
 * Table primitives for dense operational data. The wrapper scrolls horizontally on narrow
 * screens so the page itself never scrolls sideways. Cells align to the start edge, so
 * columns read correctly in both directions.
 */
export function Table({ className, ...props }: ComponentProps<'table'>) {
  return (
    <div className="w-full scrollbar-thin overflow-x-auto">
      <table
        className={cn('w-full border-separate border-spacing-0 text-base', className)}
        {...props}
      />
    </div>
  );
}

export function TableHead({ className, ...props }: ComponentProps<'thead'>) {
  return <thead className={cn('bg-surface-subtle', className)} {...props} />;
}

export function TableBody({ className, ...props }: ComponentProps<'tbody'>) {
  return <tbody className={cn('[&>tr:last-child>td]:border-b-0', className)} {...props} />;
}

/**
 * A body row. Hovering (or focusing a link inside) tints the row and draws an accent bar at
 * its start edge.
 */
export function TableRow({ className, ...props }: ComponentProps<'tr'>) {
  return (
    <tr
      className={cn(
        'transition-colors duration-100 hover:bg-surface-subtle has-[a:focus-visible]:bg-surface-subtle',
        '[&>td:first-child]:relative [&>td:first-child]:before:absolute [&>td:first-child]:before:inset-y-2 [&>td:first-child]:before:start-0',
        '[&>td:first-child]:before:w-[3px] [&>td:first-child]:before:rounded-e-full [&>td:first-child]:before:bg-primary',
        '[&>td:first-child]:before:opacity-0 [&>td:first-child]:before:transition-opacity hover:[&>td:first-child]:before:opacity-100',
        className,
      )}
      {...props}
    />
  );
}

export function TableHeaderCell({ className, ...props }: ComponentProps<'th'>) {
  return (
    <th
      scope="col"
      className={cn(
        'h-10 border-b border-border px-4 text-start eyebrow whitespace-nowrap text-muted',
        'first:ps-6 last:pe-6',
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: ComponentProps<'td'>) {
  return (
    <td
      className={cn(
        'h-14 border-b border-border px-4 py-3 text-start text-foreground first:ps-6 last:pe-6',
        className,
      )}
      {...props}
    />
  );
}
