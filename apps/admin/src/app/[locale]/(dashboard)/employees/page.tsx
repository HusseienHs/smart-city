import { MUNICIPAL_STAFF_ROLES } from '@smart-city/shared';
import Link from 'next/link';
import { Suspense } from 'react';

import { ModuleGuard } from '@/components/module-guard';
import { moduleMetadata } from '@/components/module-placeholder';
import { StaffPageSkeleton } from '@/components/staff/staff-skeleton';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { controlClasses, Select } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { PageHeader, StatStrip } from '@/components/ui/page-header';
import { IconTile, Panel } from '@/components/ui/panel';
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
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={`filter-${name}`} className="text-xs font-semibold text-foreground-secondary">
        {label}
      </label>
      <Select id={`filter-${name}`} name={name} defaultValue={value ?? ''}>
        <option value="">{t('adminEmployees.filters.any')}</option>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </Select>
    </div>
  );

  return (
    <>
      <PageHeader
        eyebrow={localizedText(staff.active.municipality_name, locale)}
        title={t('adminNav.employees')}
        description={manage ? t('adminEmployees.subtitleAdmin') : t('adminEmployees.subtitleStaff')}
        actions={
          manage ? (
            <ButtonLink
              href={localizedHref(locale, '/employees/invitations')}
              variant="primary"
              icon="userPlus"
            >
              {t('adminEmployees.invite')}
            </ButtonLink>
          ) : null
        }
      />

      {/* Head count, from the directory loaded for this page. */}
      <div className="mb-6 animate-enter">
        <StatStrip
          items={[
            {
              label: t('adminStaff.active'),
              value: directory.filter((member) => member.isActive).length,
            },
            ...(showStatus
              ? [
                  {
                    label: t('adminStaff.inactive'),
                    value: directory.filter((member) => !member.isActive).length,
                  },
                ]
              : []),
            {
              label: t('staffRole.municipality_admin'),
              value: directory.filter(
                (member) => member.isActive && member.role === 'municipality_admin',
              ).length,
            },
            { label: t('adminNav.departments'), value: departments.length },
          ]}
        />
      </div>

      <section
        aria-labelledby="staff-directory"
        className="animate-enter overflow-hidden card [animation-delay:60ms]"
      >
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <IconTile icon="employees" tone="primary" />
            <div>
              <h2
                id="staff-directory"
                className="text-md font-semibold tracking-tight text-foreground"
              >
                {t('adminEmployees.directory')}
              </h2>
              <p className="text-sm text-muted">
                {t('adminEmployees.results', { count: visible.length })}
              </p>
            </div>
          </div>
        </header>
        <form
          method="get"
          action={baseHref}
          role="search"
          className="grid items-end gap-3 border-b border-border bg-surface-subtle p-4 sm:px-5 md:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto]"
        >
          <div className="flex flex-col gap-1.5 md:col-span-2 xl:col-span-1">
            <label
              htmlFor="staff-search"
              className="text-xs font-semibold text-foreground-secondary"
            >
              {t('adminEmployees.searchLabel')}
            </label>
            <div className="relative">
              <Icon
                name="search"
                className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle"
              />
              <input
                id="staff-search"
                type="search"
                name="q"
                maxLength={100}
                defaultValue={filters.search}
                placeholder={t('adminEmployees.searchPlaceholder')}
                className={controlClasses(false, 'ps-10 pe-3')}
              />
            </div>
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
          <div className="flex items-end gap-2 md:col-span-2 xl:col-span-1">
            <Button type="submit" variant="primary" icon="filter" className="h-10">
              {t('adminEmployees.filters.apply')}
            </Button>
            {hasFilters ? (
              <ButtonLink href={baseHref} variant="ghost" className="h-10">
                {t('adminEmployees.filters.clear')}
              </ButtonLink>
            ) : null}
          </div>
        </form>

        {visible.length === 0 ? (
          <EmptyState
            icon={hasFilters ? 'search' : 'employees'}
            title={hasFilters ? t('adminEmployees.noMatches') : t('adminEmployees.empty')}
            description={!hasFilters && manage ? t('adminEmployees.emptyDescription') : undefined}
          />
        ) : (
          // People as cards: who they are first, then where they sit.
          <ul className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3 2xl:grid-cols-4">
            {visible.map((member) => {
              const name = member.fullName?.trim() || t('adminEmployees.unnamed');
              return (
                <li
                  key={member.employeeId}
                  className={cn(
                    'group/card relative flex flex-col rounded-xl bg-surface p-4 ring-1 ring-border transition-[box-shadow,transform] duration-200',
                    manage && 'hover:-translate-y-0.5 hover:shadow-md hover:ring-border-strong',
                    !member.isActive && 'bg-surface-subtle',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Avatar
                      name={name}
                      size="lg"
                      className={cn(!member.isActive && 'opacity-50 grayscale')}
                    />
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex items-center gap-2">
                        {manage ? (
                          <Link
                            href={localizedHref(locale, `/employees/${member.employeeId}`)}
                            className="truncate font-semibold text-foreground transition-colors group-hover/card:text-accent after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-focus-ring"
                            aria-label={t('adminEmployees.openEmployee', { name })}
                          >
                            {name}
                          </Link>
                        ) : (
                          <span className="truncate font-semibold text-foreground">{name}</span>
                        )}
                        {member.employeeId === self ? (
                          <Badge tone="primary" size="sm">
                            {t('adminEmployees.you')}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted">{member.jobTitle ?? '—'}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-1.5">
                    <Badge
                      tone={member.role === 'municipality_admin' ? 'violet' : 'neutral'}
                      size="sm"
                    >
                      {roleLabel(t, member.role)}
                    </Badge>
                    {showStatus ? (
                      <Badge tone={member.isActive ? 'success' : 'neutral'} dot size="sm">
                        {member.isActive ? t('adminStaff.active') : t('adminStaff.inactive')}
                      </Badge>
                    ) : null}
                  </div>
                  <dl className="mt-4 grid gap-2 border-t border-dashed border-border pt-3 text-xs">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="flex items-center gap-1.5 text-muted">
                        <Icon name="departments" className="size-3.5" />
                        {t('adminEmployees.columns.department')}
                      </dt>
                      <dd
                        className={cn(
                          'truncate font-medium',
                          member.departmentId ? 'text-foreground' : 'text-muted',
                        )}
                      >
                        {member.departmentId
                          ? (departmentName.get(member.departmentId) ?? '—')
                          : '—'}
                      </dd>
                    </div>
                    {showStatus ? (
                      <div className="flex items-center justify-between gap-3">
                        <dt className="flex items-center gap-1.5 text-muted">
                          <Icon name="calendar" className="size-3.5" />
                          {t('adminEmployees.columns.since')}
                        </dt>
                        <dd className="font-medium text-foreground tabular-nums">
                          {member.createdAt ? formatDate(locale, member.createdAt) : '—'}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
