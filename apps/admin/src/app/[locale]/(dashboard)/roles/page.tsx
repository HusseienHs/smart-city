import type { MunicipalStaffRole } from '@smart-city/shared';

import { ModuleGuard } from '@/components/module-guard';
import { moduleMetadata } from '@/components/module-placeholder';
import { Alert } from '@/components/ui/alert';
import { Icon, type IconName } from '@/components/ui/icon';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { roleLabel } from '@/lib/auth/role-label';
import { cn } from '@/lib/cn';
import { getTranslator } from '@/lib/i18n/server';
import { MATRIX_ROLES, roleMatrix, type MatrixCell } from '@/lib/staff/role-matrix';

/** Each role's emblem: an icon on its own gradient, used on the cards and the matrix head. */
const ROLE_STYLE: Record<string, { icon: IconName; gradient: string }> = {
  employee: { icon: 'user', gradient: 'from-[#0ea5e9] to-[#1d4ed8]' },
  intake_dispatcher: { icon: 'inbox', gradient: 'from-[#f59e0b] to-[#c2410c]' },
  department_manager: { icon: 'departments', gradient: 'from-[#14b8a6] to-[#0f5f73]' },
  municipality_admin: { icon: 'roles', gradient: 'from-[#8b5cf6] to-[#4338ca]' },
  platform_admin: { icon: 'layers', gradient: 'from-[#64748b] to-[#1e293b]' },
};

function RoleEmblem({ role, size = 'md' }: { role: string; size?: 'sm' | 'md' }) {
  const style = ROLE_STYLE[role] ?? ROLE_STYLE.employee!;
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center bg-gradient-to-br text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.3)]',
        style.gradient,
        size === 'md' ? 'size-10 rounded-xl' : 'size-7 rounded-lg',
      )}
    >
      <Icon name={style.icon} className={size === 'md' ? 'size-5' : 'size-3.5'} />
    </span>
  );
}

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
        <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary text-on-primary shadow-[0_2px_8px_-2px_var(--focus-ring)]">
          <Icon name="check" className="size-3.5" strokeWidth={2.5} />
          <span className="sr-only">{t('adminRoles.yes')}</span>
        </span>
      );
    }
    if (value.kind === 'no') {
      return (
        <span className="inline-flex size-6 items-center justify-center rounded-full bg-surface-muted text-subtle">
          <Icon name="minus" className="size-3" />
          <span className="sr-only">{t('adminRoles.no')}</span>
        </span>
      );
    }
    return (
      <span className="inline-block max-w-44 rounded-lg bg-primary-soft px-2.5 py-1 text-xs leading-snug font-medium text-accent ring-1 ring-primary-soft-border ring-inset">
        {t(value.key)}
      </span>
    );
  };

  // The capability column stays in view while the role columns scroll sideways.
  const sticky = 'sticky start-0 z-10 bg-surface';

  // Per role: how much of the matrix it holds, and which reports it sees. Both come from the
  // same rules as the table below.
  const rows = groups.flatMap((group) => group.rows);
  const scopeRow = rows.find((row) => row.label === 'adminRoles.rows.reportScope');

  return (
    <>
      <PageHeader
        eyebrow={t('adminNav.groups.configuration')}
        title={t('adminNav.roles')}
        description={t('adminRoles.subtitle')}
      />

      <ul className="mb-6 grid animate-enter gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {MATRIX_ROLES.map((role) => {
          const granted = rows.filter((row) => row.cells[role].kind !== 'no').length;
          const scope = scopeRow?.cells[role];
          return (
            <li key={role} className="flex flex-col card p-4">
              <div className="flex items-center gap-3">
                <RoleEmblem role={role} />
                <p className="min-w-0 text-sm leading-5 font-semibold text-foreground">
                  {roleLabel(t, role as MunicipalStaffRole | 'platform_admin')}
                </p>
              </div>
              <p className="mt-3 min-h-10 text-xs leading-5 text-muted">
                {scope && scope.kind === 'text' ? t(scope.key) : '—'}
              </p>
              <div className="mt-auto pt-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted">{t('adminRoles.capability')}</span>
                  <span className="font-mono font-medium text-foreground tabular-nums">
                    {granted}/{rows.length}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-brand-2 rtl:bg-gradient-to-l"
                    style={{ width: `${Math.round((granted / Math.max(rows.length, 1)) * 100)}%` }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
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
                  className={`${sticky} h-16 w-[26%] border-b border-border bg-surface-subtle px-5 text-start eyebrow text-muted`}
                >
                  {t('adminRoles.capability')}
                </th>
                {MATRIX_ROLES.map((role) => (
                  <th
                    key={role}
                    scope="col"
                    className="h-16 border-b border-border bg-surface-subtle px-4 text-center text-xs font-semibold whitespace-nowrap text-foreground"
                  >
                    <span className="flex flex-col items-center gap-1.5">
                      <RoleEmblem role={role} size="sm" />
                      {roleLabel(t, role as MunicipalStaffRole | 'platform_admin')}
                    </span>
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
                    className="border-b border-border bg-surface px-5 pt-5 pb-2 text-start eyebrow text-accent"
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
