import { getDepartmentReportCounts } from '@smart-city/api';
import Link from 'next/link';
import { Suspense } from 'react';

import { ModuleGuard } from '@/components/module-guard';
import { moduleMetadata } from '@/components/module-placeholder';
import { StaffPageSkeleton } from '@/components/staff/staff-skeleton';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/cn';
import { localizedText } from '@/lib/i18n/localized-text';
import { localizedHref } from '@/lib/i18n/routing';
import { getLocale, getTranslator } from '@/lib/i18n/server';
import {
  activeMembersByDepartment,
  canManageDepartments,
  canSeeDepartmentReportCount,
} from '@/lib/staff/capabilities';
import { getStaffWorkspace } from '@/lib/staff/workspace';

export function generateMetadata() {
  return moduleMetadata('departments');
}

export default function DepartmentsPage() {
  return (
    <ModuleGuard module="departments">
      <Suspense fallback={<StaffPageSkeleton />}>
        <DepartmentsList />
      </Suspense>
    </ModuleGuard>
  );
}

async function DepartmentsList() {
  const [locale, t] = await Promise.all([getLocale(), getTranslator()]);
  let workspace;
  try {
    workspace = await getStaffWorkspace();
  } catch (error) {
    console.error('[departments] load failed', error instanceof Error ? error.name : 'unknown');
    return (
      <>
        <PageHeader title={t('adminNav.departments')} />
        <Panel>
          <EmptyState icon="alert" title={t('adminDepartments.loadError')}>
            <ButtonLink href={localizedHref(locale, '/departments')} variant="primary">
              {t('common.retry')}
            </ButtonLink>
          </EmptyState>
        </Panel>
      </>
    );
  }
  const { staff, client, municipalityId, departments, directory } = workspace;
  const role = staff.active.role;
  const ownDepartment = staff.active.department_id;
  const manage = canManageDepartments(role);
  const members = activeMembersByDepartment(directory);
  const countable = departments
    .filter((d) => canSeeDepartmentReportCount(role, ownDepartment, d.id))
    .map((d) => d.id);
  const counts = await getDepartmentReportCounts(client, {
    municipalityId,
    departmentIds: countable,
  }).catch(() => ({}) as Record<string, number>);

  return (
    <>
      <PageHeader
        title={t('adminNav.departments')}
        description={
          manage ? t('adminDepartments.subtitleAdmin') : t('adminDepartments.subtitleReadOnly')
        }
        meta={<Badge tone="primary">{localizedText(staff.active.municipality_name, locale)}</Badge>}
        actions={
          manage ? (
            <ButtonLink
              href={localizedHref(locale, '/departments/new')}
              variant="primary"
              icon="plus"
            >
              {t('adminDepartments.newDepartment')}
            </ButtonLink>
          ) : null
        }
      />
      <Panel
        title={t('adminDepartments.listTitle')}
        icon="departments"
        flush
        className="animate-enter"
        actions={
          departments.length > 0 ? (
            <Badge size="sm" className="tabular-nums">
              {departments.length}
            </Badge>
          ) : null
        }
      >
        {departments.length === 0 ? (
          <EmptyState
            icon="departments"
            title={t('adminDepartments.empty')}
            description={manage ? t('adminDepartments.emptyDescription') : undefined}
          />
        ) : (
          <Table>
            <TableHead>
              <tr>
                <TableHeaderCell>{t('adminDepartments.columns.name')}</TableHeaderCell>
                <TableHeaderCell>{t('adminDepartments.columns.contact')}</TableHeaderCell>
                <TableHeaderCell>{t('adminDepartments.columns.status')}</TableHeaderCell>
                <TableHeaderCell>{t('adminDepartments.columns.members')}</TableHeaderCell>
                <TableHeaderCell>{t('adminDepartments.columns.openReports')}</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {departments.map((department) => {
                const others = (['he', 'ar', 'en'] as const)
                  .filter((language) => language !== locale && department.name[language])
                  .map((language) => department.name[language]);
                return (
                  <TableRow key={department.id} className="group/row relative">
                    <TableCell>
                      <div
                        className={cn(
                          'flex items-center gap-3',
                          !department.isActive && 'opacity-60',
                        )}
                      >
                        <span
                          aria-hidden
                          className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface-subtle text-muted transition-colors group-hover/row:border-primary-soft-border group-hover/row:bg-primary-soft group-hover/row:text-accent"
                        >
                          <Icon name="departments" className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <Link
                            href={localizedHref(locale, `/departments/${department.id}`)}
                            className="font-medium text-foreground transition-colors group-hover/row:text-accent after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-focus-ring focus-visible:after:ring-inset"
                          >
                            {localizedText(department.name, locale)}
                          </Link>
                          {others.length > 0 ? (
                            <span className="block truncate text-xs text-muted">
                              {others.join(' · ')}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-foreground-secondary">
                      {department.email ? (
                        <span className="flex items-center gap-1.5">
                          <Icon name="mail" className="size-3.5 text-subtle" />
                          <span dir="ltr">{department.email}</span>
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                      {department.phone ? (
                        <span className="mt-0.5 flex items-center gap-1.5 text-muted">
                          <Icon name="phone" className="size-3.5 text-subtle" />
                          <span dir="ltr">{department.phone}</span>
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge tone={department.isActive ? 'success' : 'neutral'} dot>
                        {department.isActive ? t('adminStaff.active') : t('adminStaff.inactive')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="inline-flex items-center gap-1.5 tabular-nums">
                        <Icon name="employees" className="size-3.5 text-subtle" />
                        {members.get(department.id) ?? 0}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {department.id in counts ? (
                        <span className="inline-flex items-center gap-1.5 font-medium tabular-nums">
                          <Icon name="reports" className="size-3.5 text-subtle" />
                          {counts[department.id]}
                        </span>
                      ) : (
                        <span className="text-muted">{t('adminDepartments.notAvailable')}</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Panel>
    </>
  );
}
