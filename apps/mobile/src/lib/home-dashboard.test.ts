import type { ReportStatus } from '@smart-city/shared';
import { describe, expect, it } from 'vitest';

import {
  dayPart,
  firstName,
  hasUnseenUpdates,
  pickTrackedReport,
  quickServices,
  summarizeMyReports,
  trackedRequestKeys,
  trackerSteps,
} from './home-dashboard';

const report = (status: ReportStatus, changed: string, id = changed) => ({
  id,
  status,
  created_at: '2026-11-01T08:00:00Z',
  status_changed_at: changed,
});

describe('summarizeMyReports', () => {
  it('groups statuses into open, in progress and resolved', () => {
    const statuses: ReportStatus[] = [
      'submitted',
      'under_review',
      'assigned',
      'in_progress',
      'resolved',
      'closed',
      'rejected',
    ];
    expect(summarizeMyReports(statuses.map((status) => ({ status })))).toEqual({
      open: 3,
      inProgress: 1,
      resolved: 2,
      total: 7,
    });
  });

  it('is all zeros without reports', () => {
    expect(summarizeMyReports([])).toEqual({ open: 0, inProgress: 0, resolved: 0, total: 0 });
  });
});

describe('pickTrackedReport', () => {
  it('picks the most recently active open report', () => {
    const picked = pickTrackedReport([
      report('submitted', '2026-11-02T08:00:00Z', 'a'),
      report('in_progress', '2026-11-05T08:00:00Z', 'b'),
      report('resolved', '2026-11-09T08:00:00Z', 'c'),
      report('rejected', '2026-11-10T08:00:00Z', 'd'),
    ]);
    expect(picked?.id).toBe('b');
  });

  it('is null when nothing is open', () => {
    expect(pickTrackedReport([report('closed', '2026-11-02T08:00:00Z')])).toBeNull();
    expect(pickTrackedReport([])).toBeNull();
  });
});

describe('trackerSteps', () => {
  const created = '2026-11-01T08:00:00Z';

  it('marks the current stage and dates every reached stage', () => {
    const steps = trackerSteps({ status: 'in_progress', created_at: created }, [
      { to_status: 'under_review', created_at: '2026-11-02T08:00:00Z' },
      { to_status: 'assigned', created_at: '2026-11-03T08:00:00Z' },
      { to_status: 'in_progress', created_at: '2026-11-04T08:00:00Z' },
    ]);
    expect(steps).toEqual([
      { stage: 'sent', state: 'done', date: created },
      { stage: 'review', state: 'done', date: '2026-11-03T08:00:00Z' },
      { stage: 'inProgress', state: 'current', date: '2026-11-04T08:00:00Z' },
      { stage: 'resolved', state: 'upcoming', date: null },
    ]);
  });

  it('starts at "sent" for a new report', () => {
    const steps = trackerSteps({ status: 'submitted', created_at: created }, []);
    expect(steps?.map((step) => step.state)).toEqual([
      'current',
      'upcoming',
      'upcoming',
      'upcoming',
    ]);
  });

  it('completes every stage for resolved and closed reports', () => {
    for (const status of ['resolved', 'closed'] as const) {
      const steps = trackerSteps({ status, created_at: created }, []);
      expect(steps?.every((step) => step.state === 'done')).toBe(true);
    }
  });

  it('ignores stages beyond the current one after a report is reopened', () => {
    const steps = trackerSteps({ status: 'in_progress', created_at: created }, [
      { to_status: 'resolved', created_at: '2026-11-05T08:00:00Z' },
      { to_status: 'in_progress', created_at: '2026-11-06T08:00:00Z' },
    ]);
    expect(steps?.[3]).toEqual({ stage: 'resolved', state: 'upcoming', date: null });
    expect(steps?.[2]?.date).toBe('2026-11-06T08:00:00Z');
    // Review was skipped: done, but without a date.
    expect(steps?.[1]).toEqual({ stage: 'review', state: 'done', date: null });
  });

  it('has no stepper for rejected reports', () => {
    expect(trackerSteps({ status: 'rejected', created_at: created }, [])).toBeNull();
  });
});

describe('quickServices', () => {
  it('keeps the municipality order, skips "other" and limits the count', () => {
    expect(quickServices(['other', 'garbage', 'road', 'streetlight', 'pothole', 'noise'])).toEqual([
      'garbage',
      'road',
      'streetlight',
      'pothole',
    ]);
    expect(quickServices(['road'])).toEqual(['road']);
    expect(quickServices([])).toEqual([]);
  });
});

describe('greeting helpers', () => {
  it('splits the day into three parts', () => {
    expect(dayPart(new Date(2026, 10, 15, 4, 59))).toBe('Evening');
    expect(dayPart(new Date(2026, 10, 15, 5, 0))).toBe('Morning');
    expect(dayPart(new Date(2026, 10, 15, 12, 0))).toBe('Afternoon');
    expect(dayPart(new Date(2026, 10, 15, 18, 0))).toBe('Evening');
  });

  it('uses the first name only', () => {
    expect(firstName('  Dana  Levi ')).toBe('Dana');
    expect(firstName('')).toBe('');
    expect(firstName(null)).toBe('');
  });
});

describe('hasUnseenUpdates', () => {
  it('is true only for announcements newer than the last visit', () => {
    expect(hasUnseenUpdates(['2026-11-10T08:00:00Z'], '2026-11-11T08:00:00Z')).toBe(false);
    expect(hasUnseenUpdates(['2026-11-12T08:00:00Z'], '2026-11-11T08:00:00Z')).toBe(true);
    expect(hasUnseenUpdates([null], null)).toBe(false);
    expect(hasUnseenUpdates([], null)).toBe(false);
  });

  it('treats any announcement as new before the first visit', () => {
    expect(hasUnseenUpdates(['2026-11-12T08:00:00Z'], null)).toBe(true);
  });
});

// Regression: Home crashed with "Cannot read properties of null (reading 'id')" whenever there was
// no report to track (loading, API error, no reports, only closed ones). The tracked report's
// loaders read `tracked!.id`; React Compiler evaluates a loader's dependencies on every render.
describe('Home with nothing to track (regression)', () => {
  it('yields null keys and no report id for a missing tracked report', () => {
    for (const missing of [null, undefined]) {
      expect(trackedRequestKeys(missing)).toEqual({ reportId: null, updates: null, photos: null });
    }
  });

  it('builds primitive keys for a tracked report', () => {
    expect(trackedRequestKeys({ id: 'r1', status_changed_at: '2026-11-02T08:00:00Z' })).toEqual({
      reportId: 'r1',
      updates: 'r1:2026-11-02T08:00:00Z',
      photos: 'photos:r1',
    });
  });

  it('keeps every state of the report list crash-free', () => {
    const scenarios = {
      empty: [],
      onlyClosed: [report('closed', '2026-11-02T08:00:00Z')],
      onlyRejected: [report('rejected', '2026-11-02T08:00:00Z')],
    };
    for (const reports of Object.values(scenarios)) {
      const tracked = pickTrackedReport(reports);
      expect(tracked).toBeNull();
      expect(trackedRequestKeys(tracked).reportId).toBeNull();
      expect(summarizeMyReports(reports).open).toBe(0);
    }
  });

  it('skips null entries and entries without an id', () => {
    const open = report('submitted', '2026-11-03T08:00:00Z', 'ok');
    const noId = { ...report('in_progress', '2026-11-09T08:00:00Z'), id: '' };
    const list = [null, undefined, noId, open];
    expect(pickTrackedReport(list)?.id).toBe('ok');
    expect(summarizeMyReports(list)).toEqual({ open: 1, inProgress: 1, resolved: 0, total: 2 });
    expect(summarizeMyReports([null, undefined])).toEqual({
      open: 0,
      inProgress: 0,
      resolved: 0,
      total: 0,
    });
  });
});
