import type { ReactNode } from 'react';

import { Skeleton } from '@/components/ui/skeleton';

/** The panel that holds an authentication form: title, subtitle and content. */
export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h1 className="text-2xl leading-9 font-semibold tracking-[-0.025em] text-foreground sm:text-3xl sm:leading-10">
        {title}
      </h1>
      {subtitle ? <p className="mt-2 text-md leading-6 text-muted">{subtitle}</p> : null}
      <div className="mt-8">{children}</div>
    </section>
  );
}

/** Placeholder while a form that depends on the request is streamed in. */
export function AuthFormSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-hidden>
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
      <Skeleton className="h-11 w-full rounded-md" />
    </div>
  );
}
