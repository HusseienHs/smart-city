import type { ReactNode } from 'react';

import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Panel } from '@/components/ui/panel';
import { canAccessModule } from '@/lib/auth/permissions';
import { roleLabel } from '@/lib/auth/role-label';
import { requireStaff } from '@/lib/auth/staff-context';
import { localizedHref } from '@/lib/i18n/routing';
import { getLocale, getTranslator } from '@/lib/i18n/server';
import type { ModuleId } from '@/lib/navigation';

/**
 * Renders `children` only for roles that may use `module`; others get a "no access" screen
 * (opening a hidden module by URL lands here). Runs on the server for every request.
 *
 * This is the user-facing check. The data each module loads is authorized independently by
 * the database, so a page that rendered by mistake would still receive no foreign data.
 */
export async function ModuleGuard({ module, children }: { module: ModuleId; children: ReactNode }) {
  const staff = await requireStaff();
  if (canAccessModule(staff.role, module)) return children;

  const locale = await getLocale();
  const t = await getTranslator();
  return (
    <Panel>
      <EmptyState
        icon="roles"
        title={t('adminAuth.forbiddenTitle')}
        description={t('adminAuth.forbiddenDescription', { role: roleLabel(t, staff.role) })}
      >
        <ButtonLink href={localizedHref(locale, '/')} variant="primary">
          {t('adminNotFound.backToOverview')}
        </ButtonLink>
      </EmptyState>
    </Panel>
  );
}
