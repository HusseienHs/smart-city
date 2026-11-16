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
    <section className="card p-6 shadow-sm sm:p-8">
      <h1 className="text-xl leading-8 font-semibold tracking-tight text-foreground sm:text-2xl">
        {title}
      </h1>
      {subtitle ? <p className="mt-1 text-base text-muted">{subtitle}</p> : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

/** Placeholder while a form that depends on the request is streamed in. */
export function AuthFormSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-hidden>
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-9 w-full rounded-sm" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-full rounded-sm" />
      </div>
      <Skeleton className="h-10 w-full rounded-sm" />
    </div>
  );
}
