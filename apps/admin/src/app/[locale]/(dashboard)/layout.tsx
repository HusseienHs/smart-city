import { Suspense } from 'react';

import { AppShell } from '@/components/shell/app-shell';
import { ShellSkeleton } from '@/components/shell/shell-skeleton';

/**
 * Every dashboard page renders inside AppShell, which verifies the session and staff
 * membership on the server before anything — chrome or page — is rendered. The Suspense
 * fallback is the only prerendered part, and it holds no data.
 */
export default function DashboardLayout({ children }: LayoutProps<'/[locale]'>) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
