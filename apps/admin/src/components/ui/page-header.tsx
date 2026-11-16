import Link from 'next/link';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { Icon } from './icon';

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Small label above the title, e.g. the navigation group. */
  eyebrow?: string;
  /** A link back to the parent page (detail pages), shown above the title. */
  back?: { href: string; label: string };
  /** Primary page actions, aligned to the end. */
  actions?: ReactNode;
  /** Status badges or metadata shown next to the title. */
  meta?: ReactNode;
  /** A visual before the title, e.g. a person's avatar. */
  leading?: ReactNode;
  /** Content under the header row, e.g. a stats strip or tabs. */
  children?: ReactNode;
}

/**
 * The page masthead: a large, tight title with its description and actions. Detail pages
 * add a back pill above it.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  back,
  actions,
  meta,
  leading,
  children,
}: PageHeaderProps) {
  return (
    <header className="mb-7 animate-enter md:mb-8">
      {back ? <BackLink href={back.href} label={back.label} className="mb-4" /> : null}
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div className="flex min-w-0 flex-1 basis-96 items-center gap-4">
          {leading}
          <div className="min-w-0">
            {eyebrow ? <p className="mb-2 eyebrow text-accent">{eyebrow}</p> : null}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="text-2xl leading-9 font-semibold tracking-[-0.02em] text-foreground sm:text-3xl sm:leading-10">
                {title}
              </h1>
              {meta ? <div className="flex flex-wrap items-center gap-2">{meta}</div> : null}
            </div>
            {description ? (
              <p className="mt-1.5 max-w-3xl text-md leading-6 text-muted">{description}</p>
            ) : null}
          </div>
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
      {children ? <div className="mt-6">{children}</div> : null}
    </header>
  );
}

/** "← Back to the list" pill above a detail page; the arrow mirrors in right-to-left layouts. */
export function BackLink({
  href,
  label,
  className,
}: {
  href: string;
  label: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group inline-flex h-7 items-center gap-1.5 rounded-full bg-surface ps-2 pe-3 text-sm font-medium text-muted ring-1 ring-border ring-inset',
        'transition-colors hover:text-foreground hover:ring-border-strong',
        className,
      )}
    >
      <Icon
        name="arrowStart"
        className="size-3.5 transition-transform duration-150 group-hover:-translate-x-0.5 rtl:group-hover:translate-x-0.5"
      />
      {label}
    </Link>
  );
}

/** A row of headline figures under a page title. Values are always real or an em dash. */
export function StatStrip({
  items,
}: {
  items: readonly { label: string; value: ReactNode; hint?: ReactNode }[];
}) {
  return (
    <dl className="grid overflow-hidden rounded-xl border border-border bg-surface shadow-xs sm:auto-cols-fr sm:grid-flow-col">
      {items.map((item, index) => (
        <div
          key={item.label}
          className={cn('px-5 py-4', index > 0 && 'border-border max-sm:border-t sm:border-s')}
        >
          <dt className="text-sm text-muted">{item.label}</dt>
          <dd className="mt-1 text-2xl leading-8 font-semibold tracking-tight text-foreground tabular-nums">
            {item.value}
          </dd>
          {item.hint ? <dd className="mt-0.5 text-xs text-muted">{item.hint}</dd> : null}
        </div>
      ))}
    </dl>
  );
}
