import { describe, expect, it } from 'vitest';

import {
  REPORT_STATUSES,
  REPORT_STATUS_TRANSITIONS,
  canTransitionReportStatus,
  isOpenReportStatus,
  isTerminalReportStatus,
  isValidTrackingNumber,
  normalizeTrackingNumber,
} from './reports';
import { STAFF_ROLES } from './roles';

describe('report status transitions', () => {
  it('only references known statuses', () => {
    for (const targets of Object.values(REPORT_STATUS_TRANSITIONS)) {
      for (const target of targets) expect(REPORT_STATUSES).toContain(target);
    }
  });

  it('never allows a self-transition', () => {
    for (const status of REPORT_STATUSES) {
      expect(REPORT_STATUS_TRANSITIONS[status]).not.toContain(status);
    }
  });

  it('treats closed and rejected as terminal', () => {
    expect(isTerminalReportStatus('closed')).toBe(true);
    expect(isTerminalReportStatus('rejected')).toBe(true);
    expect(isTerminalReportStatus('in_progress')).toBe(false);
  });

  it('requires work to be in progress before a report can be resolved', () => {
    expect(canTransitionReportStatus('submitted', 'resolved', 'municipality_admin')).toBe(false);
    expect(canTransitionReportStatus('in_progress', 'resolved', 'employee')).toBe(true);
  });

  it('never lets a citizen change a status', () => {
    for (const from of REPORT_STATUSES) {
      for (const to of REPORT_STATUSES) {
        expect(canTransitionReportStatus(from, to, 'citizen')).toBe(false);
      }
    }
  });

  it('allows every staff role to follow valid edges', () => {
    for (const role of STAFF_ROLES) {
      expect(canTransitionReportStatus('submitted', 'under_review', role)).toBe(true);
    }
  });

  it('classifies open statuses', () => {
    expect(isOpenReportStatus('assigned')).toBe(true);
    expect(isOpenReportStatus('resolved')).toBe(false);
  });
});

describe('tracking numbers', () => {
  it('accepts the canonical format', () => {
    expect(isValidTrackingNumber('TLV-2026-000123')).toBe(true);
  });

  it('rejects malformed values', () => {
    expect(isValidTrackingNumber('tlv-2026-000123')).toBe(false);
    expect(isValidTrackingNumber('TLV-26-000123')).toBe(false);
    expect(isValidTrackingNumber('TLV-2026-123')).toBe(false);
  });

  it('normalizes user input', () => {
    expect(normalizeTrackingNumber('  tlv-2026-000123 ')).toBe('TLV-2026-000123');
  });
});
