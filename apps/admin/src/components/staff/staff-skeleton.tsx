import { Skeleton } from '@/components/ui/skeleton';

/** Loading placeholder for the departments, staff and invitations pages. No data. */
export function StaffPageSkeleton() {
  return (
    <div aria-busy="true">
      <div className="mb-7 flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="overflow-clip card">
        <div className="h-12 border-b border-border" />
        <div className="h-9 border-b border-border bg-surface-subtle" />
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="flex h-14 items-center gap-4 border-b border-border px-5 last:border-b-0"
          >
            <Skeleton className="size-7 rounded-full" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
