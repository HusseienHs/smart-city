import { StaffPageSkeleton } from '@/components/staff/staff-skeleton';

/**
 * The content-area fallback for every dashboard page. A sidebar click only re-renders below
 * the dashboard layout, so the layout's own Suspense boundary can't show anything during the
 * transition; this boundary sits below it. Without it, the page stays frozen until the server
 * has verified the session and loaded the data. It holds no data, so it is safe to prefetch
 * as part of each route's App Shell, which makes the click respond instantly.
 */
export default function DashboardLoading() {
  return <StaffPageSkeleton />;
}
