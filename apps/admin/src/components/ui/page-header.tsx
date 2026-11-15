import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Small label above the title, e.g. the navigation group. */
  eyebrow?: string;
  /** Primary page actions, aligned to the end. */
  actions?: ReactNode;
  /** Status badges or metadata shown next to the title. */
  meta?: ReactNode;
}

export function PageHeader({ title, description, eyebrow, actions, meta }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-xs font-medium tracking-wide text-muted uppercase">{eyebrow}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {meta}
        </div>
        {description ? (
          <p className="mt-1.5 max-w-3xl text-base text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
