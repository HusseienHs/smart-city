import { getDepartmentReportCounts } from '@smart-city/api';
import Link from 'next/link';
import { Suspense } from 'react';

import { ModuleGuard } from '@/components/module-guard';
import { moduleMetadata } from '@/components/module-placeholder';
import { StaffPageSkeleton } from '@/components/staff/staff-skeleton';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
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
      <Panel title={t('adminDepartments.listTitle')} flush>
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
                  <TableRow key={department.id} className="relative">
                    <TableCell>
                      <Link
                        href={localizedHref(locale, `/departments/${department.id}`)}
                        className="font-medium text-primary after:absolute after:inset-0 hover:underline"
                      >
                        {localizedText(department.name, locale)}
                      </Link>
                      {others.length > 0 ? (
                        <span className="block text-xs text-muted">{others.join(' · ')}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm text-foreground-secondary">
                      <span className="block" dir="ltr">
                        {department.email ?? '—'}
                      </span>
                      <span className="block" dir="ltr">
                        {department.phone ?? ''}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge tone={department.isActive ? 'success' : 'neutral'} dot>
                        {department.isActive ? t('adminStaff.active') : t('adminStaff.inactive')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{members.get(department.id) ?? 0}</TableCell>
                    <TableCell className="text-sm">
                      {department.id in counts
                        ? counts[department.id]
                        : t('adminDepartments.notAvailable')}
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
