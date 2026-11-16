import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { Icon, type IconName } from './icon';

export interface DescriptionItem {
  label: string;
  value: ReactNode;
  icon?: IconName;
}

/**
 * Label/value pairs for detail pages. `stacked` puts the label above the value (narrow
 * sidebars); `inline` puts them side by side (wide panels).
 */
export function DescriptionList({
  items,
  layout = 'stacked',
  className,
}: {
  items: readonly DescriptionItem[];
  layout?: 'stacked' | 'inline';
  className?: string;
}) {
  return (
    <dl className={cn(layout === 'inline' ? 'divide-y divide-border' : 'grid gap-4', className)}>
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(
            layout === 'inline'
              ? 'grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] sm:gap-4'
              : 'flex flex-col gap-1',
          )}
        >
          <dt className="flex items-center gap-1.5 text-sm text-muted">
            {item.icon ? <Icon name={item.icon} className="size-3.5" /> : null}
            {item.label}
          </dt>
          <dd className="min-w-0 text-base break-words text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
