import Link from 'next/link';
import type { ReactNode } from 'react';

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
}

export function PageHeader({ title, description, eyebrow, back, actions, meta }: PageHeaderProps) {
  return (
    <header className="mb-6 flex animate-enter flex-wrap items-end justify-between gap-x-6 gap-y-4 md:mb-7">
      <div className="min-w-0 flex-1 basis-80">
        {back ? (
          <Link
            href={back.href}
            className="group mb-3 inline-flex items-center gap-1.5 rounded-xs text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            <Icon
              name="arrowStart"
              className="size-4 transition-transform duration-150 group-hover:-translate-x-0.5 rtl:group-hover:translate-x-0.5"
            />
            {back.label}
          </Link>
        ) : null}
        {eyebrow ? <p className="mb-1.5 text-xs font-medium text-muted">{eyebrow}</p> : null}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-xl leading-8 font-semibold tracking-tight text-foreground sm:text-2xl">
            {title}
          </h1>
          {meta ? <div className="flex flex-wrap items-center gap-2">{meta}</div> : null}
        </div>
        {description ? <p className="mt-1 max-w-3xl text-base text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
