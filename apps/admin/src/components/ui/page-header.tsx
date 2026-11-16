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
}

export function PageHeader({
  title,
  description,
  eyebrow,
  back,
  actions,
  meta,
  leading,
}: PageHeaderProps) {
  return (
    <header className="mb-6 flex animate-enter flex-wrap items-end justify-between gap-x-6 gap-y-4 md:mb-7">
      <div className="min-w-0 flex-1 basis-80">
        {back ? <BackLink href={back.href} label={back.label} className="mb-3" /> : null}
        <div className="flex min-w-0 items-center gap-4">
          {leading}
          <div className="min-w-0">
            {eyebrow ? <p className="mb-1.5 text-xs font-medium text-muted">{eyebrow}</p> : null}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="text-xl leading-8 font-semibold tracking-tight text-foreground sm:text-2xl">
                {title}
              </h1>
              {meta ? <div className="flex flex-wrap items-center gap-2">{meta}</div> : null}
            </div>
            {description ? (
              <p className="mt-1 max-w-3xl text-base text-muted">{description}</p>
            ) : null}
          </div>
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** "← Back to the list" above a detail page; the arrow mirrors in right-to-left layouts. */
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
        'group inline-flex items-center gap-1.5 rounded-xs text-sm font-medium text-muted transition-colors hover:text-foreground',
        className,
      )}
    >
      <Icon
        name="arrowStart"
        className="size-4 transition-transform duration-150 group-hover:-translate-x-0.5 rtl:group-hover:translate-x-0.5"
      />
      {label}
    </Link>
  );
}
