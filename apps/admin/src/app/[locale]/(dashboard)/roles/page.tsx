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
        <span className="inline-flex size-6 items-center justify-center rounded-full border border-success-border bg-success-soft text-success">
          <Icon name="check" className="size-3.5" strokeWidth={2.25} />
          <span className="sr-only">{t('adminRoles.yes')}</span>
        </span>
      );
    }
    if (value.kind === 'no') {
      return (
        <span className="inline-flex size-6 items-center justify-center rounded-full text-subtle">
          <Icon name="minus" className="size-3.5" />
          <span className="sr-only">{t('adminRoles.no')}</span>
        </span>
      );
    }
    return (
      <span className="inline-block max-w-44 rounded-sm border border-primary-soft-border bg-primary-soft px-2 py-1 text-xs leading-snug text-foreground-secondary">
        {t(value.key)}
      </span>
    );
  };

  // The capability column stays in view while the role columns scroll sideways.
  const sticky = 'sticky start-0 z-10 bg-surface';

  return (
    <>
      <PageHeader title={t('adminNav.roles')} description={t('adminRoles.subtitle')} />
      <Panel
        title={t('adminRoles.matrixTitle')}
        icon="roles"
        flush
        className="animate-enter"
        actions={
          <div className="flex items-center gap-3 text-xs text-muted" aria-hidden>
            <span className="flex items-center gap-1.5">
              <span className="inline-flex size-4 items-center justify-center rounded-full border border-success-border bg-success-soft text-success">
                <Icon name="check" className="size-2.5" strokeWidth={2.5} />
              </span>
              {t('adminRoles.yes')}
            </span>
            <span className="flex items-center gap-1.5">
              <Icon name="minus" className="size-3.5 text-subtle" />
              {t('adminRoles.no')}
            </span>
          </div>
        }
      >
        <div className="w-full scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-base">
            <thead>
              <tr>
                <th
                  scope="col"
                  className={`${sticky} h-12 w-[26%] border-b border-border bg-surface-subtle px-5 text-start text-xs font-medium text-muted`}
                >
                  {t('adminRoles.capability')}
                </th>
                {MATRIX_ROLES.map((role) => (
                  <th
                    key={role}
                    scope="col"
                    className="h-12 border-b border-border bg-surface-subtle px-4 text-center text-xs font-semibold whitespace-nowrap text-foreground"
                  >
                    {roleLabel(t, role as MunicipalStaffRole | 'platform_admin')}
                  </th>
                ))}
              </tr>
            </thead>
            {groups.map((group) => (
              <tbody key={group.label}>
                <tr>
                  <th
                    scope="colgroup"
                    colSpan={MATRIX_ROLES.length + 1}
                    className="border-b border-border bg-surface-subtle/60 px-5 pt-4 pb-2 text-start text-2xs font-semibold text-muted"
                  >
                    {t(group.label)}
                  </th>
                </tr>
                {group.rows.map((row) => (
                  <tr
                    key={row.label}
                    className="group/row border-b border-border last:border-b-0 hover:bg-surface-subtle"
                  >
                    <th
                      scope="row"
                      className={`${sticky} px-5 py-3 text-start text-sm font-medium text-foreground group-hover/row:bg-surface-subtle`}
                    >
                      {t(row.label)}
                    </th>
                    {MATRIX_ROLES.map((role) => (
                      <td key={role} className="px-4 py-3 text-center align-middle">
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
