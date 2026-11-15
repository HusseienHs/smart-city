import { useId, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

interface PanelProps {
  title?: ReactNode;
  description?: ReactNode;
  /** Controls aligned to the end of the header (buttons, filters). */
  actions?: ReactNode;
  /** Removes the body padding, e.g. for tables and lists that run edge to edge. */
  flush?: boolean;
  className?: string;
  children: ReactNode;
}

/** The basic content container: a bordered white surface with an optional header. */
export function Panel({ title, description, actions, flush, className, children }: PanelProps) {
  const titleId = useId();
  const hasHeader = Boolean(title || description || actions);
  return (
    <section
      className={cn('rounded-lg border border-border bg-surface shadow-xs', className)}
      aria-labelledby={title ? titleId : undefined}
    >
      {hasHeader ? (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            {title ? (
              <h2 id={titleId} className="text-md font-semibold text-foreground">
                {title}
              </h2>
            ) : null}
            {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={flush ? undefined : 'p-5'}>{children}</div>
    </section>
  );
}
