import { Skeleton } from '@/components/ui/skeleton';

/** Loading placeholder for the departments, staff and invitations pages. No data. */
export function StaffPageSkeleton() {
  return (
    <div aria-busy="true">
      <div className="mb-8 flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="rounded-lg border border-border bg-surface">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border px-5 py-4 last:border-b-0"
          >
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
