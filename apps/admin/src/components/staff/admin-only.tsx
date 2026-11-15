import type { ReactNode } from 'react';

import { EmptyState } from '@/components/ui/empty-state';
import { Panel } from '@/components/ui/panel';
import { requireStaff } from '@/lib/auth/staff-context';
import { getTranslator } from '@/lib/i18n/server';
import { canManageStaff } from '@/lib/staff/capabilities';

/**
 * Renders `children` only for municipality admins (inside a module other roles may open).
 * User experience only: the data and actions behind it are authorized by the database.
 */
export async function AdminOnly({ children }: { children: ReactNode }) {
  const staff = await requireStaff();
  if (canManageStaff(staff.role)) return children;
  const t = await getTranslator();
  return (
    <Panel>
      <EmptyState
        icon="roles"
        title={t('adminStaff.adminOnlyTitle')}
        description={t('adminStaff.adminOnlyDescription')}
      />
    </Panel>
  );
}
