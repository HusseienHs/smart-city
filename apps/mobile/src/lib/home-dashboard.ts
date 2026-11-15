/**
 * Pure helpers behind the Home dashboard: the report summary, which report to track, the stages
 * of the tracking stepper, the quick-service categories and the time-of-day greeting.
 *
 * All data is the citizen's own (`getMyReports`, `getMyReportUpdates`) or the municipality's
 * enabled categories; nothing here invents numbers.
 */
import type { ReportCategory, ReportStatus } from '@smart-city/shared';

interface ReportLike {
  status: ReportStatus;
  created_at: string;
  status_changed_at: string;
}

interface UpdateLike {
  to_status: ReportStatus;
  created_at: string;
}

export interface ReportSummary {
  open: number;
  inProgress: number;
  resolved: number;
  total: number;
}

/** Statuses counted as "open" on Home: sent and waiting for (or in) triage. */
const OPEN = new Set<ReportStatus>(['submitted', 'under_review', 'assigned']);
const RESOLVED = new Set<ReportStatus>(['resolved', 'closed']);

/**
 * Open / in progress / resolved counts. Rejected reports count only toward `total`.
 * Missing entries (null/undefined) are skipped rather than crashing the dashboard.
 */
export function summarizeMyReports(
  reports: readonly (Pick<ReportLike, 'status'> | null | undefined)[],
): ReportSummary {
  const summary: ReportSummary = { open: 0, inProgress: 0, resolved: 0, total: 0 };
  for (const report of reports) {
    if (!report) continue;
    summary.total += 1;
    if (OPEN.has(report.status)) summary.open += 1;
    else if (report.status === 'in_progress') summary.inProgress += 1;
    else if (RESOLVED.has(report.status)) summary.resolved += 1;
  }
  return summary;
}

/**
 * The report shown in "Track your report": the most recently active one that is still open.
 * Entries without an id are ignored (nothing could be opened or loaded for them).
 */
export function pickTrackedReport<T extends ReportLike & { id: string }>(
  reports: readonly (T | null | undefined)[],
): T | null {
  let best: T | null = null;
  for (const report of reports) {
    if (!report?.id) continue;
    if (!OPEN.has(report.status) && report.status !== 'in_progress') continue;
    if (!best || activity(report) > activity(best)) best = report;
  }
  return best;
}

export interface TrackedRequestKeys {
  reportId: string | null;
  /** useAsync key for the tracked report's status updates (null = nothing to load). */
  updates: string | null;
  /** useAsync key for the tracked report's photos (null = nothing to load). */
  photos: string | null;
}

/**
 * Plain-string request keys for the tracked report. Home must only hand primitives to its
 * loaders: React Compiler reads a loader's dependencies on every render, so a property read on a
 * possibly-null report inside a loader crashes Home when there is nothing to track.
 */
export function trackedRequestKeys(
  tracked: (Pick<ReportLike, 'status_changed_at'> & { id: string }) | null | undefined,
): TrackedRequestKeys {
  const reportId = tracked?.id || null;
  if (!reportId) return { reportId: null, updates: null, photos: null };
  return {
    reportId,
    updates: `${reportId}:${tracked?.status_changed_at ?? ''}`,
    photos: `photos:${reportId}`,
  };
}

function activity(report: ReportLike): number {
  const time = Date.parse(report.status_changed_at || report.created_at);
  return Number.isNaN(time) ? 0 : time;
}

export const TRACKER_STAGES = ['sent', 'review', 'inProgress', 'resolved'] as const;
export type TrackerStage = (typeof TRACKER_STAGES)[number];

export interface TrackerStep {
  stage: TrackerStage;
  state: 'done' | 'current' | 'upcoming';
  /** When the report reached this stage (ISO), for done and current stages. */
  date: string | null;
}

const STAGE_OF: Record<ReportStatus, number> = {
  submitted: 0,
  under_review: 1,
  assigned: 1,
  in_progress: 2,
  resolved: 3,
  closed: 3,
  rejected: -1,
};

/**
 * The four citizen-facing stages for a report's current status, with the date each was reached
 * (the latest matching public status change; "sent" is the report's creation). A rejected report
 * has no stepper (null).
 */
export function trackerSteps(
  report: Pick<ReportLike, 'status' | 'created_at'>,
  updates: readonly UpdateLike[],
): TrackerStep[] | null {
  const current = STAGE_OF[report.status];
  if (current < 0) return null;
  const reached: (string | null)[] = [report.created_at, null, null, null];
  for (const update of updates) {
    const stage = STAGE_OF[update.to_status];
    if (stage > 0 && stage <= current) {
      const previous = reached[stage];
      if (!previous || Date.parse(update.created_at) > Date.parse(previous)) {
        reached[stage] = update.created_at;
      }
    }
  }
  return TRACKER_STAGES.map((stage, index) => ({
    stage,
    state:
      index < current
        ? 'done'
        : index === current
          ? current === 3
            ? 'done'
            : 'current'
          : 'upcoming',
    date: index <= current ? (reached[index] ?? null) : null,
  }));
}

/** The first `count` categories the municipality offers, in its own order. */
export function quickServices(offered: readonly ReportCategory[], count = 4): ReportCategory[] {
  return offered.filter((category) => category !== 'other').slice(0, count);
}

export type DayPart = 'Morning' | 'Afternoon' | 'Evening';

/** Morning 05:00–11:59, afternoon 12:00–17:59, evening otherwise (device local time). */
export function dayPart(date: Date): DayPart {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'Morning';
  if (hour >= 12 && hour < 18) return 'Afternoon';
  return 'Evening';
}

/** First name for the greeting ("Dana Levi" → "Dana"); empty when there is no name. */
export function firstName(fullName: string | null | undefined): string {
  return (fullName ?? '').trim().split(/\s+/)[0] ?? '';
}

/** True when an announcement was published after the citizen last opened Updates. */
export function hasUnseenUpdates(
  publishedAt: readonly (string | null)[],
  lastSeen: string | null,
): boolean {
  const seen = lastSeen ? Date.parse(lastSeen) : Number.NaN;
  return publishedAt.some((value) => {
    if (!value) return false;
    const time = Date.parse(value);
    if (Number.isNaN(time)) return false;
    return Number.isNaN(seen) || time > seen;
  });
}
