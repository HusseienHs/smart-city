import type { ReactNode } from 'react';

import { Icon, type IconName } from './icon';

interface EmptyStateProps {
  icon?: IconName;
  title: string;
  description?: string;
  /** Extra content under the description: badges, notes or a call to action. */
  children?: ReactNode;
}

/** Shown when there is nothing to display yet. Never filled with placeholder data. */
export function EmptyState({ icon = 'info', title, description, children }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="mb-4 flex size-11 items-center justify-center rounded-full border border-primary-soft-border bg-primary-soft text-primary">
        <Icon name={icon} />
      </span>
      <p className="text-md font-semibold text-foreground">{title}</p>
      {description ? <p className="mt-1 max-w-md text-base text-muted">{description}</p> : null}
      {children ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{children}</div>
      ) : null}
    </div>
  );
}
