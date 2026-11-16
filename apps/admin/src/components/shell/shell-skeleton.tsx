import { Skeleton } from '@/components/ui/skeleton';

/**
 * Shown while the session and memberships are checked. Contains no data of any kind, so the
 * prerendered static shell can never reveal anything about a user or municipality.
 */
export function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh" aria-busy="true">
      <div className="sticky top-0 hidden h-dvh w-(--sidebar-width) shrink-0 flex-col gap-3 border-e border-border bg-sidebar p-3 md:flex rail:w-(--sidebar-rail-width)">
        <Skeleton className="size-8 rounded-md" />
        <Skeleton className="mt-2 h-12 w-full rounded-lg" />
        <div className="mt-3 space-y-2">
          {[0, 1, 2, 3, 4, 5].map((row) => (
            <Skeleton key={row} className="h-7 w-full rounded-md" />
          ))}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-(--header-height) border-b border-border" />
        <div className="mx-auto w-full max-w-(--content-max-width) px-4 pt-6 md:px-6 md:pt-8 xl:px-10">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="mt-3 h-4 w-72" />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((tile) => (
              <Skeleton key={tile} className="h-32 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
