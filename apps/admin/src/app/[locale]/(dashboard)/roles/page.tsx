import type { MunicipalStaffRole } from '@smart-city/shared';

import { ModuleGuard } from '@/components/module-guard';
import { moduleMetadata } from '@/components/module-placeholder';
import { Alert } from '@/components/ui/alert';
import { Icon } from '@/components/ui/icon';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { roleLabel } from '@/lib/auth/role-label';
import { getTranslator } from '@/lib/i18n/server';
import { MATRIX_ROLES, roleMatrix, type MatrixCell } from '@/lib/staff/role-matrix';

export function generateMetadata() {
  return moduleMetadata('roles');
}

export default function RolesPage() {
  return (
    <ModuleGuard module="roles">
      <RolesMatrix />
    </ModuleGuard>
  );
}

/**
 * Read-only: the permissions computed from the dashboard's own rules (which mirror the
 * database). Changing roles happens on each staff member's page.
 */
async function RolesMatrix() {
  const t = await getTranslator();
  const groups = roleMatrix();

  const cell = (value: MatrixCell) => {
    if (value.kind === 'yes') {
      return (
        <span className="inline-flex items-center gap-1 text-success">
          <Icon name="check" className="size-4" />
          <span className="sr-only">{t('adminRoles.yes')}</span>
        </span>
      );
    }
    if (value.kind === 'no') {
      return (
        <span className="text-subtle">
          <span aria-hidden>—</span>
          <span className="sr-only">{t('adminRoles.no')}</span>
        </span>
      );
    }
    return <span className="text-sm text-foreground-secondary">{t(value.key)}</span>;
  };

  return (
    <>
      <PageHeader title={t('adminNav.roles')} description={t('adminRoles.subtitle')} />
      <Panel title={t('adminRoles.matrixTitle')} flush>
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-base">
            <thead className="bg-surface-subtle">
              <tr>
                <th
                  scope="col"
                  className="h-10 border-b border-border px-4 text-start text-xs font-medium text-muted"
                >
                  {t('adminRoles.capability')}
                </th>
                {MATRIX_ROLES.map((role) => (
                  <th
                    key={role}
                    scope="col"
                    className="h-10 border-b border-border px-4 text-start text-xs font-medium whitespace-nowrap text-muted"
                  >
                    {roleLabel(t, role as MunicipalStaffRole | 'platform_admin')}
                  </th>
                ))}
              </tr>
            </thead>
            {groups.map((group) => (
              <tbody key={group.label} className="divide-y divide-border">
                <tr>
                  <th
                    scope="colgroup"
                    colSpan={MATRIX_ROLES.length + 1}
                    className="bg-surface-subtle/60 px-4 py-2 text-start text-xs font-semibold tracking-wide text-foreground uppercase"
                  >
                    {t(group.label)}
                  </th>
                </tr>
                {group.rows.map((row) => (
                  <tr key={row.label}>
                    <th
                      scope="row"
                      className="px-4 py-2.5 text-start text-sm font-medium text-foreground"
                    >
                      {t(row.label)}
                    </th>
                    {MATRIX_ROLES.map((role) => (
                      <td key={role} className="px-4 py-2.5 align-top">
                        {cell(row.cells[role])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </Panel>
      <Alert tone="info" className="mt-4">
        {t('adminRoles.platformNote')}
      </Alert>
    </>
  );
}
