import type { ReportStatus } from '@smart-city/shared';
import { describe, expect, it } from 'vitest';

import {
  countMyReportFilters,
  filterMyReports,
  reportFilterOf,
  toReportCategory,
} from './my-reports';

const all: ReportStatus[] = [
  'submitted',
  'under_review',
  'assigned',
  'in_progress',
  'resolved',
  'closed',
  'rejected',
];

describe('my report filters', () => {
  it('puts every status in exactly one filter', () => {
    expect(all.map(reportFilterOf)).toEqual([
      'open',
      'open',
      'open',
      'open',
      'resolved',
      'resolved',
      'rejected',
    ]);
  });

  it('filters and counts', () => {
    const reports = all.map((status) => ({ status }));
    expect(filterMyReports(reports, 'all')).toHaveLength(7);
    expect(filterMyReports(reports, 'resolved').map((r) => r.status)).toEqual([
      'resolved',
      'closed',
    ]);
    expect(countMyReportFilters(reports)).toEqual({ all: 7, open: 4, resolved: 2, rejected: 1 });
  });

  it('shows unknown category codes as "other"', () => {
    expect(toReportCategory('pothole')).toBe('pothole');
    expect(toReportCategory('graffiti')).toBe('other');
  });
});
