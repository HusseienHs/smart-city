/**
 * Display helpers for the citizen's own reports. The data comes from @smart-city/api
 * (`getMyReports`, `getMyReportUpdates`), which only ever return the caller's reports.
 */
import {
  isSupportedLocale,
  REPORT_CATEGORIES,
  type ReportCategory,
  type ReportStatus,
} from '@smart-city/shared';

export type { MyReport, MyReportUpdate } from '@smart-city/api';

/** Municipalities may use category codes the app doesn't know yet: show them as "other". */
export function toReportCategory(code: string): ReportCategory {
  return (REPORT_CATEGORIES as readonly string[]).includes(code)
    ? (code as ReportCategory)
    : 'other';
}

/** Localized calendar date, e.g. "5 Nov 2026" / "5 בנוב׳ 2026". */
export function formatReportDate(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(isSupportedLocale(locale) ? locale : 'he', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export const MY_REPORT_FILTERS = ['all', 'open', 'resolved', 'rejected'] as const;
export type MyReportFilter = (typeof MY_REPORT_FILTERS)[number];

/** Which filter a status belongs to (besides "all"). */
export function reportFilterOf(status: ReportStatus): Exclude<MyReportFilter, 'all'> {
  if (status === 'rejected') return 'rejected';
  if (status === 'resolved' || status === 'closed') return 'resolved';
  return 'open';
}

export function filterMyReports<T extends { status: ReportStatus }>(
  reports: readonly T[],
  filter: MyReportFilter,
): T[] {
  return filter === 'all'
    ? [...reports]
    : reports.filter((r) => reportFilterOf(r.status) === filter);
}

export function countMyReportFilters(
  reports: readonly { status: ReportStatus }[],
): Record<MyReportFilter, number> {
  const counts: Record<MyReportFilter, number> = { all: 0, open: 0, resolved: 0, rejected: 0 };
  for (const report of reports) {
    counts.all += 1;
    counts[reportFilterOf(report.status)] += 1;
  }
  return counts;
}
