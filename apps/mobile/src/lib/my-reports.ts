/**
 * Display helpers for the citizen's own reports. The data comes from @smart-city/api
 * (`getMyReports`, `getMyReportUpdates`), which only ever return the caller's reports.
 */
import { isSupportedLocale, REPORT_CATEGORIES, type ReportCategory } from '@smart-city/shared';

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
