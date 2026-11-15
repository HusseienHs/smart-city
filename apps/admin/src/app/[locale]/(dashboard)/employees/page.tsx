import { MUNICIPAL_STAFF_ROLES } from '@smart-city/shared';
import Link from 'next/link';
import { Suspense } from 'react';

import { ModuleGuard } from '@/components/module-guard';
import { moduleMetadata } from '@/components/module-placeholder';
import { StaffPageSkeleton } from '@/components/staff/staff-skeleton';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
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
import { roleLabel } from '@/lib/auth/role-label';
import { cn } from '@/lib/cn';
import { localizedText } from '@/lib/i18n/localized-text';
import { localizedHref } from '@/lib/i18n/routing';
import { getLocale, getTranslator } from '@/lib/i18n/server';
import { formatDate } from '@/lib/reports/format';
import {
  canManageStaff,
  canViewFormerStaff,
  filterDirectory,
  parseDirectoryFilters,
} from '@/lib/staff/capabilities';
import { getStaffWorkspace } from '@/lib/staff/workspace';

export function generateMetadata() {
  return moduleMetadata('employees');
}

export default function EmployeesPage({ searchParams }: PageProps<'/[locale]/employees'>) {
  return (
    <ModuleGuard module="employees">
      <Suspense fallback={<StaffPageSkeleton />}>
        <Directory searchParams={searchParams} />
      </Suspense>
    </ModuleGuard>
  );
}

const CONTROL =
  'h-9 w-full appearance-none rounded-sm border border-border-strong bg-surface px-3 pe-9 text-base text-foreground shadow-xs focus:border-primary focus:ring-3 focus:ring-primary/15 focus:outline-none';

async function Directory({
  searchParams,
}: {
  searchParams: PageProps<'/[locale]/employees'>['searchParams'];
}) {
  const [params, locale, t] = await Promise.all([searchParams, getLocale(), getTranslator()]);
  const baseHref = localizedHref(locale, '/employees');
  let workspace;
  try {
    workspace = await getStaffWorkspace();
  } catch (error) {
    console.error('[employees] load failed', error instanceof Error ? error.name : 'unknown');
    return (
      <>
        <PageHeader title={t('adminNav.employees')} />
        <Panel>
          <EmptyState icon="alert" title={t('adminEmployees.loadError')}>
            <ButtonLink href={baseHref} variant="primary">
              {t('common.retry')}
            </ButtonLink>
          </EmptyState>
        </Panel>
      </>
    );
  }
  const { staff, departments, directory } = workspace;
  const role = staff.active.role;
  const manage = canManageStaff(role);
  const showStatus = canViewFormerStaff(role);
  const filters = parseDirectoryFilters(params);
  const visible = filterDirectory(
    directory,
    showStatus ? filters : { ...filters, status: undefined },
  );
  const departmentName = new Map(departments.map((d) => [d.id, localizedText(d.name, locale)]));
  const hasFilters = Boolean(
    filters.search || filters.role || filters.department || filters.status,
  );
  const self = staff.active.employee_id;

  const select = (
    name: string,
    label: string,
    value: string | undefined,
    options: [string, string][],
  ) => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`filter-${name}`} className="text-sm font-medium text-foreground-secondary">
        {label}
      </label>
      <div className="relative">
        <select id={`filter-${name}`} name={name} defaultValue={value ?? ''} className={CONTROL}>
          <option value="">{t('adminEmployees.filters.any')}</option>
          {options.map(([optionValue, optionLabel]) => (
            <option key={optionValue} value={optionValue}>
              {optionLabel}
            </option>
          ))}
        </select>
        <Icon
          name="chevronDown"
          className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted"
        />
      </div>
    </div>
  );

  return (
    <>
      <PageHeader
        title={t('adminNav.employees')}
        description={manage ? t('adminEmployees.subtitleAdmin') : t('adminEmployees.subtitleStaff')}
        meta={<Badge tone="primary">{localizedText(staff.active.municipality_name, locale)}</Badge>}
        actions={
          manage ? (
            <ButtonLink
              href={localizedHref(locale, '/employees/invitations')}
              variant="primary"
              icon="mail"
            >
              {t('adminEmployees.invite')}
            </ButtonLink>
          ) : null
        }
      />

      <Panel flush className="mb-6">
        <form
          method="get"
          action={baseHref}
          role="search"
          className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-5"
        >
          <div className="flex flex-col gap-1.5 xl:col-span-2">
            <label htmlFor="staff-search" className="text-sm font-medium text-foreground-secondary">
              {t('adminEmployees.searchLabel')}
            </label>
            <input
              id="staff-search"
              type="search"
              name="q"
              maxLength={100}
              defaultValue={filters.search}
              placeholder={t('adminEmployees.searchPlaceholder')}
              className={CONTROL.replace('appearance-none', '')}
            />
          </div>
          {select(
            'role',
            t('adminEmployees.filters.role'),
            filters.role,
            MUNICIPAL_STAFF_ROLES.map((value) => [value, t(`staffRole.${value}`)]),
          )}
          {select('department', t('adminEmployees.filters.department'), filters.department, [
            ['none', t('adminEmployees.filters.noDepartment')],
            ...departments.map((d): [string, string] => [d.id, localizedText(d.name, locale)]),
          ])}
          {showStatus
            ? select('status', t('adminEmployees.filters.status'), filters.status, [
                ['active', t('adminStaff.active')],
                ['inactive', t('adminStaff.inactive')],
              ])
            : null}
          <div className="flex items-end gap-2 md:col-span-2 xl:col-span-5">
            <Button type="submit" variant="primary" icon="filter">
              {t('adminEmployees.filters.apply')}
            </Button>
            {hasFilters ? (
              <ButtonLink href={baseHref} variant="ghost">
                {t('adminEmployees.filters.clear')}
              </ButtonLink>
            ) : null}
          </div>
        </form>
      </Panel>

      <Panel
        title={t('adminEmployees.directory')}
        description={t('adminEmployees.results', { count: visible.length })}
        flush
      >
        {visible.length === 0 ? (
          <EmptyState
            icon="employees"
            title={hasFilters ? t('adminEmployees.noMatches') : t('adminEmployees.empty')}
            description={!hasFilters && manage ? t('adminEmployees.emptyDescription') : undefined}
          />
        ) : (
          <Table>
            <TableHead>
              <tr>
                <TableHeaderCell>{t('adminEmployees.columns.name')}</TableHeaderCell>
                <TableHeaderCell>{t('adminEmployees.columns.role')}</TableHeaderCell>
                <TableHeaderCell>{t('adminEmployees.columns.department')}</TableHeaderCell>
                <TableHeaderCell>{t('adminEmployees.columns.jobTitle')}</TableHeaderCell>
                {showStatus ? (
                  <TableHeaderCell>{t('adminEmployees.columns.status')}</TableHeaderCell>
                ) : null}
                {showStatus ? (
                  <TableHeaderCell>{t('adminEmployees.columns.since')}</TableHeaderCell>
                ) : null}
              </tr>
            </TableHead>
            <TableBody>
              {visible.map((member) => {
                const name = member.fullName?.trim() || t('adminEmployees.unnamed');
                return (
                  <TableRow
                    key={member.employeeId}
                    className={cn(manage && 'relative', !member.isActive && 'text-muted')}
                  >
                    <TableCell>
                      {manage ? (
                        <Link
                          href={localizedHref(locale, `/employees/${member.employeeId}`)}
                          className="font-medium text-primary after:absolute after:inset-0 hover:underline"
                          aria-label={t('adminEmployees.openEmployee', { name })}
                        >
                          {name}
                        </Link>
                      ) : (
                        <span className="font-medium text-foreground">{name}</span>
                      )}
                      {member.employeeId === self ? (
                        <Badge tone="primary" className="ms-2">
                          {t('adminEmployees.you')}
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {roleLabel(t, member.role)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {member.departmentId ? (departmentName.get(member.departmentId) ?? '—') : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-foreground-secondary">
                      {member.jobTitle ?? '—'}
                    </TableCell>
                    {showStatus ? (
                      <TableCell>
                        <Badge tone={member.isActive ? 'success' : 'neutral'} dot>
                          {member.isActive ? t('adminStaff.active') : t('adminStaff.inactive')}
                        </Badge>
                      </TableCell>
                    ) : null}
                    {showStatus ? (
                      <TableCell className="text-sm whitespace-nowrap text-foreground-secondary">
                        {member.createdAt ? formatDate(locale, member.createdAt) : '—'}
                      </TableCell>
                    ) : null}
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
