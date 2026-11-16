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
import { PageHeader, StatStrip } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
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
        eyebrow={localizedText(staff.active.municipality_name, locale)}
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
      <div className="mb-6 animate-enter">
        <StatStrip
          items={[
            { label: t('adminDepartments.listTitle'), value: departments.length },
            {
              label: t('adminStaff.active'),
              value: departments.filter((department) => department.isActive).length,
            },
            {
              label: t('adminDepartments.columns.members'),
              value: departments.reduce((sum, d) => sum + (members.get(d.id) ?? 0), 0),
            },
          ]}
        />
      </div>

      {departments.length === 0 ? (
        <section className="animate-enter card">
          <EmptyState
            icon="departments"
            title={t('adminDepartments.empty')}
            description={manage ? t('adminDepartments.emptyDescription') : undefined}
          >
            {manage ? (
              <ButtonLink
                href={localizedHref(locale, '/departments/new')}
                variant="primary"
                icon="plus"
              >
                {t('adminDepartments.newDepartment')}
              </ButtonLink>
            ) : null}
          </EmptyState>
        </section>
      ) : (
        <section
          aria-label={t('adminDepartments.listTitle')}
          className="animate-enter [animation-delay:60ms]"
        >
          <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {departments.map((department) => {
              const others = (['he', 'ar', 'en'] as const)
                .filter((language) => language !== locale && department.name[language])
                .map((language) => department.name[language]);
              return (
                <li
                  key={department.id}
                  className={cn(
                    'group/card relative flex flex-col overflow-hidden card transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-md',
                    !department.isActive && 'bg-surface-subtle',
                  )}
                >
                  <div className="flex items-start gap-4 p-5">
                    <span
                      aria-hidden
                      className={cn(
                        'flex size-12 shrink-0 items-center justify-center rounded-xl text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.3)]',
                        department.isActive
                          ? 'bg-gradient-to-br from-[#14b8a6] to-[#0f5f73]'
                          : 'bg-[#8a93a5] dark:bg-[#3a4152]',
                      )}
                    >
                      <Icon name="departments" className="size-[22px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <Link
                          href={localizedHref(locale, `/departments/${department.id}`)}
                          className="text-md leading-6 font-semibold tracking-tight text-foreground transition-colors group-hover/card:text-accent after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-[inherit] focus-visible:after:ring-2 focus-visible:after:ring-focus-ring focus-visible:after:ring-inset"
                        >
                          {localizedText(department.name, locale)}
                        </Link>
                        <Badge tone={department.isActive ? 'success' : 'neutral'} dot size="sm">
                          {department.isActive ? t('adminStaff.active') : t('adminStaff.inactive')}
                        </Badge>
                      </div>
                      {others.length > 0 ? (
                        <p className="mt-0.5 truncate text-xs text-muted">{others.join(' · ')}</p>
                      ) : null}
                      <div className="mt-3 flex flex-col gap-1 text-sm text-foreground-secondary">
                        {department.email ? (
                          <span className="flex items-center gap-2">
                            <Icon name="mail" className="size-3.5 text-subtle" />
                            <span dir="ltr" className="truncate">
                              {department.email}
                            </span>
                          </span>
                        ) : null}
                        {department.phone ? (
                          <span className="flex items-center gap-2">
                            <Icon name="phone" className="size-3.5 text-subtle" />
                            <span dir="ltr">{department.phone}</span>
                          </span>
                        ) : null}
                        {!department.email && !department.phone ? (
                          <span className="flex items-center gap-2 text-muted">
                            <Icon name="mail" className="size-3.5 text-subtle" />—
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <dl className="mt-auto grid grid-cols-2 border-t border-border bg-surface-subtle">
                    <div className="px-5 py-3">
                      <dt className="flex items-center gap-1.5 text-xs text-muted">
                        <Icon name="employees" className="size-3.5" />
                        {t('adminDepartments.columns.members')}
                      </dt>
                      <dd className="mt-0.5 text-lg font-semibold text-foreground tabular-nums">
                        {members.get(department.id) ?? 0}
                      </dd>
                    </div>
                    <div className="border-s border-border px-5 py-3">
                      <dt className="flex items-center gap-1.5 text-xs text-muted">
                        <Icon name="reports" className="size-3.5" />
                        {t('adminDepartments.columns.openReports')}
                      </dt>
                      <dd className="mt-0.5 text-lg font-semibold text-foreground tabular-nums">
                        {department.id in counts ? (
                          counts[department.id]
                        ) : (
                          <span className="text-subtle">{t('adminDepartments.notAvailable')}</span>
                        )}
                      </dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
