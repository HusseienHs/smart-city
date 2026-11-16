import {
  listStaffReports,
  STAFF_REPORT_DEFAULT_PAGE_SIZE,
  type StaffReportPage,
} from '@smart-city/api';
import { Suspense } from 'react';

import { ModuleGuard } from '@/components/module-guard';
import { moduleMetadata } from '@/components/module-placeholder';
import { ActiveFilters, ReportsFilters } from '@/components/reports/reports-filters';
import { ReportsPagination, ReportsTable } from '@/components/reports/reports-table';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { localizedText } from '@/lib/i18n/localized-text';
import { localizedHref } from '@/lib/i18n/routing';
import { getLocale, getTranslator } from '@/lib/i18n/server';
import {
  activeFilterKeys,
  filtersQuery,
  parseReportFilters,
  toListInput,
} from '@/lib/reports/filters';
import { reportLabels } from '@/lib/reports/labels';
import { getReportsWorkspace } from '@/lib/reports/workspace';

export function generateMetadata() {
  return moduleMetadata('reports');
}

export default function ReportsPage({ searchParams }: PageProps<'/[locale]/reports'>) {
  return (
    <ModuleGuard module="reports">
      <Suspense fallback={<ReportsListSkeleton />}>
        <ReportsList searchParams={searchParams} />
      </Suspense>
    </ModuleGuard>
  );
}

async function ReportsList({
  searchParams,
}: {
  searchParams: PageProps<'/[locale]/reports'>['searchParams'];
}) {
  const [params, workspace, locale, t] = await Promise.all([
    searchParams,
    getReportsWorkspace(),
    getLocale(),
    getTranslator(),
  ]);
  const { staff, municipalityId, client, directory, colleagues } = workspace;
  const role = staff.active.role;
  const { filters, invalid } = parseReportFilters(params);
  const labels = reportLabels(directory, colleagues, locale, t);
  const baseHref = localizedHref(locale, '/reports');

  let page: StaffReportPage | null = null;
  try {
    page = await listStaffReports(
      client,
      toListInput(filters, municipalityId, STAFF_REPORT_DEFAULT_PAGE_SIZE),
    );
  } catch (error) {
    console.error('[reports] list failed', error instanceof Error ? error.name : 'unknown');
  }

  const hasFilters = activeFilterKeys(filters).length > 0;

  return (
    <>
      <PageHeader
        eyebrow={localizedText(staff.active.municipality_name, locale)}
        title={t('adminNav.reports')}
        description={t(`adminReports.scope.${role}`)}
        meta={
          page ? (
            <Badge tone="primary" dot className="tabular-nums">
              {t('adminReports.list.results', { total: page.total })}
            </Badge>
          ) : null
        }
      />

      {invalid ? (
        <Alert tone="warning" className="mb-4">
          {t('adminReports.list.invalidFilters')}
        </Alert>
      ) : null}

      <Panel flush className="animate-enter">
        <h2 className="sr-only">{t('adminReports.list.filters')}</h2>
        <ReportsFilters
          filters={filters}
          directory={directory}
          locale={locale}
          t={t}
          baseHref={baseHref}
          options={{
            // Managers and employees only ever see their own department (RLS).
            showDepartment: role === 'municipality_admin',
            // Only employees and managers can be assignees (assign_report).
            showAssignedToMe: role === 'employee' || role === 'department_manager',
            // Dispatchers only see unassigned reports, employees only assigned ones.
            showUnassigned: role === 'municipality_admin' || role === 'department_manager',
          }}
        />
        <ActiveFilters
          filters={filters}
          labels={labels}
          locale={locale}
          t={t}
          baseHref={baseHref}
        />
        <div className="border-t border-border">
          {!page ? (
            <EmptyState
              icon="alert"
              title={t('adminReports.list.loadErrorTitle')}
              description={t('adminReports.list.loadErrorDescription')}
            >
              <ButtonLink
                href={`${baseHref}${filtersQuery(filters, { page: filters.page })}`}
                variant="primary"
              >
                {t('common.retry')}
              </ButtonLink>
            </EmptyState>
          ) : page.items.length === 0 ? (
            hasFilters || page.total > 0 ? (
              <EmptyState
                icon="search"
                title={t('adminReports.list.noMatchesTitle')}
                description={t('adminReports.list.noMatchesDescription')}
              >
                {page.total > 0 && filters.page > 1 ? (
                  <ButtonLink href={`${baseHref}${filtersQuery(filters)}`} variant="secondary">
                    {t('adminReports.pagination.previous')}
                  </ButtonLink>
                ) : (
                  <ButtonLink href={baseHref} variant="secondary">
                    {t('adminReports.list.clear')}
                  </ButtonLink>
                )}
              </EmptyState>
            ) : (
              <EmptyState
                icon="reports"
                title={t('adminReports.list.emptyTitle')}
                description={t('adminReports.list.emptyDescription')}
              />
            )
          ) : (
            <ReportsTable
              reports={page.items}
              filters={filters}
              labels={labels}
              locale={locale}
              t={t}
              baseHref={baseHref}
            />
          )}
        </div>
        {page ? (
          <ReportsPagination
            filters={filters}
            total={page.total}
            page={page.page}
            pageSize={page.pageSize}
            pageCount={page.pageCount}
            t={t}
            baseHref={baseHref}
          />
        ) : null}
      </Panel>
    </>
  );
}

function ReportsListSkeleton() {
  return (
    <div aria-busy="true">
      <div className="mb-7 flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="overflow-clip card">
        <div className="space-y-3 border-b border-border p-5">
          <Skeleton className="h-10 w-full rounded-md" />
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 7 }, (_, i) => (
              <Skeleton key={i} className="h-7 w-20 rounded-full" />
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-7 w-16 rounded-full" />
            ))}
          </div>
        </div>
        <div className="h-9 border-b border-border bg-surface-subtle" />
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className="flex h-13 items-center gap-4 border-b border-border px-5 last:border-b-0"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20 max-sm:hidden" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-14 rounded-full max-sm:hidden" />
          </div>
        ))}
      </div>
    </div>
  );
}
