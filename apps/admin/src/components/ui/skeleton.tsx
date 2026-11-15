import { cn } from '@/lib/cn';

/** A loading placeholder block. Size it with width/height utilities. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xs bg-surface-muted', className)} aria-hidden />;
}
