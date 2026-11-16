import type { StaffReportSortField, StaffReportSummary } from '@smart-city/api';
import type { Locale } from '@smart-city/shared';
import type { Translator } from '@smart-city/shared/i18n';
import Link from 'next/link';

import { ReportStatusBadge } from '@/components/report-status-badge';
import { Icon } from '@/components/ui/icon';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/cn';
import { filtersQuery, sortChange, type ReportFilters } from '@/lib/reports/filters';
import { formatDateTime } from '@/lib/reports/format';
import type { ReportLabels } from '@/lib/reports/labels';

import { ReportPriorityBadge } from './report-priority-badge';

interface ReportsTableProps {
  reports: readonly StaffReportSummary[];
  filters: ReportFilters;
  labels: ReportLabels;
  locale: Locale;
  t: Translator;
  /** The list page, e.g. `/he/reports`. Report links are `${baseHref}/{id}`. */
  baseHref: string;
}

function place(report: StaffReportSummary, labels: ReportLabels): string | null {
  const neighborhood = labels.neighborhood(report.neighborhood_id);
  const parts = [report.address?.trim(), neighborhood].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** The reports list: a sortable table from `md` up, cards on narrow screens. */
export function ReportsTable({ reports, filters, labels, locale, t, baseHref }: ReportsTableProps) {
  const sortable = (column: StaffReportSortField, label: string) => {
    const active = filters.sort === column;
    const direction = active ? filters.direction : undefined;
    return (
      <TableHeaderCell
        aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : undefined}
      >
        <Link
          href={`${baseHref}${filtersQuery(filters, sortChange(filters, column))}`}
          className={cn(
            'inline-flex items-center gap-1 rounded-xs hover:text-foreground',
            active && 'text-foreground',
          )}
          aria-label={t('adminReports.list.sortBy', { column: label })}
        >
          {label}
          {active ? (
            <span aria-hidden className="text-[10px]">
              {direction === 'asc' ? '▲' : '▼'}
            </span>
          ) : null}
          {active ? (
            <span className="sr-only">
              {direction === 'asc'
                ? t('adminReports.list.sortedAscending')
                : t('adminReports.list.sortedDescending')}
            </span>
          ) : null}
        </Link>
      </TableHeaderCell>
    );
  };

  return (
    <>
      <div className="max-md:hidden">
        <Table aria-label={t('adminReports.list.tableLabel')}>
          <TableHead>
            <tr>
              <TableHeaderCell>{t('adminReports.columns.trackingNumber')}</TableHeaderCell>
              <TableHeaderCell>{t('adminReports.columns.category')}</TableHeaderCell>
              <TableHeaderCell className="min-w-56">
                {t('adminReports.columns.description')}
              </TableHeaderCell>
              {sortable('status', t('adminReports.columns.status'))}
              {sortable('priority', t('adminReports.columns.priority'))}
              <TableHeaderCell>{t('adminReports.columns.department')}</TableHeaderCell>
              <TableHeaderCell>{t('adminReports.columns.assignee')}</TableHeaderCell>
              <TableHeaderCell>{t('adminReports.columns.location')}</TableHeaderCell>
              {sortable('created_at', t('adminReports.columns.createdAt'))}
              {sortable('updated_at', t('adminReports.columns.updatedAt'))}
            </tr>
          </TableHead>
          <TableBody>
            {reports.map((report) => (
              // The tracking-number link stretches over the whole row.
              <TableRow key={report.id} className="relative">
                <TableCell className="whitespace-nowrap">
                  <Link
                    href={`${baseHref}/${report.id}`}
                    className="font-medium text-accent after:absolute after:inset-0 hover:underline focus-visible:outline-none focus-visible:after:ring-3 focus-visible:after:ring-primary/30"
                    aria-label={t('adminReports.list.openReport', {
                      trackingNumber: report.tracking_number,
                    })}
                    dir="ltr"
                  >
                    {report.tracking_number}
                  </Link>
                </TableCell>
                <TableCell className="whitespace-nowrap text-foreground-secondary">
                  {labels.category(report.category_id)}
                </TableCell>
                <TableCell className="max-w-xs">
                  <span className="line-clamp-2 text-sm">{report.description}</span>
                </TableCell>
                <TableCell>
                  <ReportStatusBadge
                    status={report.status}
                    label={t(`reportStatus.${report.status}`)}
                  />
                </TableCell>
                <TableCell>
                  <ReportPriorityBadge
                    priority={report.priority}
                    label={t(`reportPriority.${report.priority}`)}
                  />
                </TableCell>
                <TableCell className="text-sm whitespace-nowrap">
                  {labels.department(report.department_id)}
                </TableCell>
                <TableCell
                  className={cn('text-sm whitespace-nowrap', !report.assignee_id && 'text-muted')}
                >
                  {labels.person(report.assignee_id)}
                </TableCell>
                <TableCell className="max-w-48 text-sm text-foreground-secondary">
                  <span className="line-clamp-2">{place(report, labels) ?? '—'}</span>
                </TableCell>
                <TableCell className="text-sm whitespace-nowrap text-foreground-secondary">
                  {formatDateTime(locale, report.created_at)}
                </TableCell>
                <TableCell className="text-sm whitespace-nowrap text-foreground-secondary">
                  {formatDateTime(locale, report.updated_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul
        className="divide-y divide-border md:hidden"
        aria-label={t('adminReports.list.tableLabel')}
      >
        {reports.map((report) => (
          <li key={report.id}>
            <Link
              href={`${baseHref}/${report.id}`}
              className="flex flex-col gap-2 px-4 py-3.5 transition-colors hover:bg-surface-subtle"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="font-medium text-accent" dir="ltr">
                  {report.tracking_number}
                </span>
                <Icon name="chevronEnd" className="size-4 text-subtle" />
              </span>
              <span className="text-sm text-foreground-secondary">
                {labels.category(report.category_id)}
              </span>
              <span className="line-clamp-2 text-sm">{report.description}</span>
              <span className="flex flex-wrap gap-1.5">
                <ReportStatusBadge
                  status={report.status}
                  label={t(`reportStatus.${report.status}`)}
                />
                <ReportPriorityBadge
                  priority={report.priority}
                  label={t(`reportPriority.${report.priority}`)}
                />
              </span>
              <span className="text-xs text-muted">
                {labels.department(report.department_id)} · {labels.person(report.assignee_id)} ·{' '}
                {formatDateTime(locale, report.created_at)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

/** "Showing 26–50 of 113", previous / next and the page number. */
export function ReportsPagination({
  filters,
  total,
  page,
  pageSize,
  pageCount,
  t,
  baseHref,
}: {
  filters: ReportFilters;
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  t: Translator;
  baseHref: string;
}) {
  if (total === 0) return null;
  const from = Math.min(total, (page - 1) * pageSize + 1);
  const to = Math.min(total, page * pageSize);
  const link = (target: number) => `${baseHref}${filtersQuery(filters, { page: target })}`;
  const navClass =
    'inline-flex h-8 items-center gap-1.5 rounded-sm border border-border-strong bg-surface px-3 text-sm font-medium text-foreground shadow-xs hover:bg-surface-subtle';
  const disabledClass =
    'inline-flex h-8 items-center gap-1.5 rounded-sm border border-border px-3 text-sm text-subtle';

  return (
    <nav
      aria-label={t('adminReports.pagination.label')}
      className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3"
    >
      <p className="text-sm text-muted">
        {page <= pageCount
          ? t('adminReports.pagination.summary', { from, to, total })
          : t('adminReports.list.results', { total })}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link
            href={link(Math.min(page - 1, Math.max(pageCount, 1)))}
            className={navClass}
            rel="prev"
          >
            <Icon name="chevronEnd" className="size-4 rotate-180" />
            {t('adminReports.pagination.previous')}
          </Link>
        ) : (
          <span className={disabledClass} aria-disabled="true">
            <Icon name="chevronEnd" className="size-4 rotate-180" />
            {t('adminReports.pagination.previous')}
          </span>
        )}
        <span className="text-sm text-foreground-secondary">
          {t('adminReports.pagination.page', {
            page: Math.min(page, Math.max(pageCount, 1)),
            pages: Math.max(pageCount, 1),
          })}
        </span>
        {page < pageCount ? (
          <Link href={link(page + 1)} className={navClass} rel="next">
            {t('adminReports.pagination.next')}
            <Icon name="chevronEnd" className="size-4" />
          </Link>
        ) : (
          <span className={disabledClass} aria-disabled="true">
            {t('adminReports.pagination.next')}
            <Icon name="chevronEnd" className="size-4" />
          </span>
        )}
      </div>
    </nav>
  );
}
