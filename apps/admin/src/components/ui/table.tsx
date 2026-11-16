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
      <table className={cn('w-full border-collapse text-base', className)} {...props} />
    </div>
  );
}

export function TableHead({ className, ...props }: ComponentProps<'thead'>) {
  return <thead className={cn('bg-surface-subtle', className)} {...props} />;
}

export function TableBody({ className, ...props }: ComponentProps<'tbody'>) {
  return <tbody className={cn('divide-y divide-border', className)} {...props} />;
}

export function TableRow({ className, ...props }: ComponentProps<'tr'>) {
  return (
    <tr
      className={cn(
        'transition-colors duration-100 hover:bg-surface-subtle has-[a:focus-visible]:bg-surface-subtle',
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
        'h-9 border-b border-border px-4 text-start text-xs font-medium whitespace-nowrap text-muted',
        'first:ps-5 last:pe-5',
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: ComponentProps<'td'>) {
  return (
    <td
      className={cn('h-13 px-4 py-2.5 text-start text-foreground first:ps-5 last:pe-5', className)}
      {...props}
    />
  );
}
