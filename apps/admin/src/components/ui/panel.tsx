import { useId, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { Icon, type IconName } from './icon';

interface PanelProps {
  title?: ReactNode;
  description?: ReactNode;
  /** An icon tile before the title. */
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

/** The icon tile used in panel and section headers. */
export function IconTile({
  icon,
  tone = 'neutral',
  size = 'md',
  className,
}: {
  icon: IconName;
  tone?: 'neutral' | 'primary' | 'info' | 'success' | 'warning' | 'danger' | 'violet';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const tones = {
    neutral: 'bg-surface-muted text-foreground-secondary ring-border',
    primary: 'bg-primary-soft text-accent ring-primary-soft-border',
    info: 'bg-info-soft text-info ring-info-border',
    success: 'bg-success-soft text-success ring-success-border',
    warning: 'bg-warning-soft text-warning ring-warning-border',
    danger: 'bg-danger-soft text-danger ring-danger-border',
    violet: 'bg-violet-soft text-violet ring-violet-border',
  } as const;
  const sizes = {
    sm: ['size-7 rounded-md', 'size-3.5'],
    md: ['size-8 rounded-lg', 'size-4'],
    lg: ['size-11 rounded-xl', 'size-5'],
  } as const;
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center ring-1 ring-inset',
        tones[tone],
        sizes[size][0],
        className,
      )}
    >
      <Icon name={icon} className={sizes[size][1]} />
    </span>
  );
}

/**
 * The basic content container: a rounded card. With a header, the title sits in an open
 * band (no rule) above padded content; flush content (tables, lists) gets a hairline.
 */
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
        <header
          className={cn(
            'flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 pt-4',
            flush ? 'border-b border-border pb-4' : 'pb-1',
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            {icon ? <IconTile icon={icon} /> : null}
            <div className="min-w-0">
              {title ? (
                <h2
                  id={titleId}
                  className="text-md leading-6 font-semibold tracking-tight text-foreground"
                >
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
        <footer className="rounded-b-xl border-t border-border bg-surface-subtle px-5 py-3">
          {footer}
        </footer>
      ) : null}
    </section>
  );
}
