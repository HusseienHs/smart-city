import type { StaffReportSortField, StaffReportSummary } from '@smart-city/api';
import type { Locale } from '@smart-city/shared';
import type { Translator } from '@smart-city/shared/i18n';
import Link from 'next/link';

import { ReportStatusBadge } from '@/components/report-status-badge';
import { Avatar } from '@/components/ui/avatar';
import { buttonClasses } from '@/components/ui/button';
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

/** The assignee with an avatar, or a muted "unassigned" label. */
function Assignee({ id, labels }: { id: string | null; labels: ReportLabels }) {
  const name = labels.person(id);
  if (!id) return <span className="text-muted">{name}</span>;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar name={name} size="xs" />
      <span className="truncate">{name}</span>
    </span>
  );
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
            'group/sort -mx-2 inline-flex h-7 items-center gap-1.5 rounded-md px-2 transition-colors hover:bg-surface-muted hover:text-foreground',
            active && 'bg-surface-muted text-foreground',
          )}
          aria-label={t('adminReports.list.sortBy', { column: label })}
        >
          {label}
          <Icon
            name={active ? (direction === 'asc' ? 'arrowUp' : 'arrowDown') : 'chevronsUpDown'}
            className={cn(
              'size-3.5',
              active ? 'text-accent' : 'opacity-0 transition-opacity group-hover/sort:opacity-60',
            )}
          />
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
              <TableHeaderCell className="min-w-64">
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
              <TableRow key={report.id} className="group/row relative">
                <TableCell className="whitespace-nowrap">
                  <Link
                    href={`${baseHref}/${report.id}`}
                    className="block w-fit rounded-sm font-mono text-[13px] font-medium text-foreground tabular-nums group-hover/row:text-accent after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-focus-ring focus-visible:after:ring-inset"
                    aria-label={t('adminReports.list.openReport', {
                      trackingNumber: report.tracking_number,
                    })}
                    dir="ltr"
                  >
                    {report.tracking_number}
                  </Link>
                  <span className="mt-0.5 block max-w-44 truncate text-xs text-muted">
                    {labels.category(report.category_id)}
                  </span>
                </TableCell>
                <TableCell className="max-w-sm">
                  <span
                    className="line-clamp-2 text-sm leading-5 text-foreground-secondary"
                    dir="auto"
                  >
                    {report.description}
                  </span>
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
                <TableCell
                  className={cn('text-sm whitespace-nowrap', !report.department_id && 'text-muted')}
                >
                  {labels.department(report.department_id)}
                </TableCell>
                <TableCell className="max-w-48 text-sm whitespace-nowrap">
                  <Assignee id={report.assignee_id} labels={labels} />
                </TableCell>
                <TableCell className="max-w-48 text-sm text-muted">
                  <span className="line-clamp-2">{place(report, labels) ?? '—'}</span>
                </TableCell>
                <TableCell className="text-sm whitespace-nowrap text-muted tabular-nums">
                  {formatDateTime(locale, report.created_at)}
                </TableCell>
                <TableCell className="text-sm whitespace-nowrap text-muted tabular-nums">
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
              className="flex flex-col gap-2.5 px-4 py-4 transition-colors hover:bg-surface-subtle active:bg-surface-muted"
            >
              <span className="flex items-center justify-between gap-3">
                <span
                  className="font-mono text-[13px] font-medium text-foreground tabular-nums"
                  dir="ltr"
                >
                  {report.tracking_number}
                </span>
                <span className="flex items-center gap-2 text-xs text-muted tabular-nums">
                  {formatDateTime(locale, report.created_at)}
                  <Icon name="chevronEnd" className="size-4 text-subtle" />
                </span>
              </span>
              <span className="text-sm font-medium text-foreground-secondary">
                {labels.category(report.category_id)}
              </span>
              <span className="line-clamp-2 text-sm text-muted">{report.description}</span>
              <span className="flex flex-wrap items-center gap-1.5">
                <ReportStatusBadge
                  status={report.status}
                  label={t(`reportStatus.${report.status}`)}
                />
                <ReportPriorityBadge
                  priority={report.priority}
                  label={t(`reportPriority.${report.priority}`)}
                />
              </span>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                <span className="flex items-center gap-1">
                  <Icon name="departments" className="size-3.5" />
                  {labels.department(report.department_id)}
                </span>
                <span className="flex items-center gap-1">
                  <Icon name="user" className="size-3.5" />
                  {labels.person(report.assignee_id)}
                </span>
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
  const navClass = buttonClasses({ variant: 'secondary', size: 'sm' });
  const disabledClass = cn(navClass, 'pointer-events-none opacity-50 shadow-none');

  const current = Math.min(page, Math.max(pageCount, 1));
  const pages = pageWindow(current, Math.max(pageCount, 1));
  const square =
    'inline-flex size-8 items-center justify-center rounded-md text-sm font-medium tabular-nums transition-colors';

  return (
    <nav
      aria-label={t('adminReports.pagination.label')}
      className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-subtle px-4 py-3 sm:px-6"
    >
      <p className="text-sm text-muted tabular-nums">
        {page <= pageCount
          ? t('adminReports.pagination.summary', { from, to, total })
          : t('adminReports.list.results', { total })}
      </p>
      <div className="flex items-center gap-1.5">
        {page > 1 ? (
          <Link
            href={link(Math.min(page - 1, Math.max(pageCount, 1)))}
            className={navClass}
            rel="prev"
          >
            <Icon name="chevronStart" className="size-4" />
            <span className="max-sm:sr-only">{t('adminReports.pagination.previous')}</span>
          </Link>
        ) : (
          <span className={disabledClass} aria-disabled="true">
            <Icon name="chevronStart" className="size-4" />
            <span className="max-sm:sr-only">{t('adminReports.pagination.previous')}</span>
          </span>
        )}
        <span className="sr-only">
          {t('adminReports.pagination.page', { page: current, pages: Math.max(pageCount, 1) })}
        </span>
        <ul className="flex items-center gap-1 max-sm:hidden">
          {pages.map((entry, index) =>
            entry === null ? (
              <li key={`gap-${index}`} aria-hidden className="px-1 text-subtle">
                …
              </li>
            ) : (
              <li key={entry}>
                {entry === current ? (
                  <span
                    aria-current="page"
                    className={cn(
                      square,
                      'bg-surface text-foreground shadow-xs ring-1 ring-border-strong',
                    )}
                  >
                    {entry}
                  </span>
                ) : (
                  <Link
                    href={link(entry)}
                    className={cn(
                      square,
                      'text-muted hover:bg-surface-muted hover:text-foreground',
                    )}
                  >
                    {entry}
                  </Link>
                )}
              </li>
            ),
          )}
        </ul>
        {page < pageCount ? (
          <Link href={link(page + 1)} className={navClass} rel="next">
            <span className="max-sm:sr-only">{t('adminReports.pagination.next')}</span>
            <Icon name="chevronEnd" className="size-4" />
          </Link>
        ) : (
          <span className={disabledClass} aria-disabled="true">
            <span className="max-sm:sr-only">{t('adminReports.pagination.next')}</span>
            <Icon name="chevronEnd" className="size-4" />
          </span>
        )}
      </div>
    </nav>
  );
}

/** Page numbers to show: the first, the last and the current with its neighbours; null = gap. */
function pageWindow(current: number, count: number): (number | null)[] {
  const wanted = new Set([1, count, current - 1, current, current + 1]);
  const pages = [...wanted].filter((n) => n >= 1 && n <= count).sort((x, y) => x - y);
  const result: (number | null)[] = [];
  pages.forEach((n, index) => {
    if (index > 0 && n - pages[index - 1]! > 1) result.push(null);
    result.push(n);
  });
  return result;
}
