import type { ReactNode } from 'react';

/**
 * The head of a record page (a person, a department): an ink cover band, the record's emblem
 * overlapping its lower edge, then the title, badges and description.
 */
export function Masthead({
  emblem,
  title,
  description,
  meta,
  actions,
}: {
  /** The record's visual, ~64px, e.g. an avatar or an icon tile. */
  emblem: ReactNode;
  title: string;
  description?: string;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 animate-enter overflow-hidden card">
      <div className="relative isolate h-24 ink-surface sm:h-28">
        <div aria-hidden className="absolute inset-0 -z-10 grid-lines" />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 px-5 pb-5 sm:px-6">
        <div className="flex min-w-0 flex-1 basis-96 flex-col gap-3 sm:flex-row sm:items-end sm:gap-5">
          <div className="-mt-10 shrink-0 rounded-[20px] bg-surface p-1 shadow-md sm:-mt-12">
            {emblem}
          </div>
          <div className="min-w-0 pb-0.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="text-2xl leading-9 font-semibold tracking-[-0.02em] text-foreground">
                {title}
              </h1>
              {meta ? <div className="flex flex-wrap items-center gap-2">{meta}</div> : null}
            </div>
            {description ? <p className="mt-0.5 text-md text-muted">{description}</p> : null}
          </div>
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
