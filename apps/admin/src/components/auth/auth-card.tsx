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
    <section className="rounded-lg border border-border bg-surface p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      {subtitle ? <p className="mt-1.5 text-base text-muted">{subtitle}</p> : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

/** Placeholder while a form that depends on the request is streamed in. */
export function AuthFormSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-hidden>
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}
