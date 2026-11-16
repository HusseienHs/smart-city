import { useId, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { Icon, type IconName } from './icon';

interface PanelProps {
  title?: ReactNode;
  description?: ReactNode;
  /** A small icon before the title. */
  icon?: IconName;
  /** Controls aligned to the end of the header (buttons, filters). */
  actions?: ReactNode;
  /** Removes the body padding, e.g. for tables and lists that run edge to edge. */
  flush?: boolean;
  /** Content pinned under the body, e.g. pagination or form actions. */
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** The basic content container: a bordered card with an optional header and footer. */
export function Panel({
  title,
  description,
  icon,
  actions,
  flush,
  footer,
  className,
  children,
}: PanelProps) {
  const titleId = useId();
  const hasHeader = Boolean(title || description || actions);
  return (
    <section
      // Flush content (tables) is clipped to the rounded corners; padded panels never clip,
      // so menus inside forms can extend past them.
      className={cn('min-w-0 card', flush && 'overflow-clip', className)}
      aria-labelledby={title ? titleId : undefined}
    >
      {hasHeader ? (
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b border-border px-5 py-3.5">
          <div className="flex min-w-0 items-start gap-2.5">
            {icon ? <Icon name={icon} className="mt-0.5 size-[18px] text-muted" /> : null}
            <div className="min-w-0">
              {title ? (
                <h2 id={titleId} className="text-base leading-6 font-semibold text-foreground">
                  {title}
                </h2>
              ) : null}
              {description ? <p className="text-sm text-muted">{description}</p> : null}
            </div>
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={flush ? undefined : 'p-5'}>{children}</div>
      {footer ? (
        <footer className="border-t border-border bg-surface-subtle px-5 py-3">{footer}</footer>
      ) : null}
    </section>
  );
}
