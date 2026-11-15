import { STAFF_WORKFLOW_MESSAGES } from '@smart-city/api';
import { messages } from '@smart-city/shared/i18n';
import { describe, expect, it } from 'vitest';

import {
  assignmentMode,
  canEditAssignment,
  canReturnToIntake,
  canViewReporterContact,
  completionUpload,
  statusTargets,
} from './capabilities';

const routed = (
  status: 'submitted' | 'under_review' | 'assigned' | 'in_progress' | 'resolved',
) => ({
  status,
  department_id: 'dept',
});

describe('status targets (mirror update_report_status)', () => {
  it('follows the workflow for handling roles', () => {
    expect(statusTargets('municipality_admin', routed('assigned'))).toEqual([
      'in_progress',
      'under_review',
      'rejected',
    ]);
    expect(statusTargets('employee', routed('in_progress'))).toEqual(['resolved', 'assigned']);
    expect(statusTargets('department_manager', routed('resolved'))).toEqual([
      'closed',
      'in_progress',
    ]);
  });

  it('limits intake dispatchers to review and rejection', () => {
    expect(
      statusTargets('intake_dispatcher', { status: 'submitted', department_id: null }),
    ).toEqual(['under_review', 'rejected']);
  });

  it('never offers "assigned" before the report has a department', () => {
    expect(
      statusTargets('municipality_admin', { status: 'submitted', department_id: null }),
    ).toEqual(['under_review', 'rejected']);
  });

  it('offers nothing for finished reports or platform admins', () => {
    expect(statusTargets('municipality_admin', { status: 'closed', department_id: 'd' })).toEqual(
      [],
    );
    expect(
      statusTargets('municipality_admin', { status: 'rejected', department_id: null }),
    ).toEqual([]);
    expect(statusTargets('platform_admin', routed('submitted'))).toEqual([]);
  });
});

describe('assignment (mirror assign_report)', () => {
  it('gives each role its mode', () => {
    expect(assignmentMode('municipality_admin')).toBe('full');
    expect(assignmentMode('department_manager')).toBe('department');
    expect(assignmentMode('intake_dispatcher')).toBe('route');
    expect(assignmentMode('employee')).toBe('none');
    expect(assignmentMode('platform_admin')).toBe('none');
  });

  it('is read-only for employees and for finished reports', () => {
    expect(canEditAssignment('employee', 'assigned')).toBe(false);
    for (const status of ['resolved', 'closed', 'rejected'] as const) {
      expect(canEditAssignment('municipality_admin', status)).toBe(false);
    }
    expect(canEditAssignment('department_manager', 'in_progress')).toBe(true);
  });

  it('allows returning to intake only before work starts', () => {
    expect(canReturnToIntake('department_manager', 'assigned')).toBe(true);
    expect(canReturnToIntake('department_manager', 'in_progress')).toBe(false);
    expect(canReturnToIntake('employee', 'assigned')).toBe(false);
  });
});

describe('reporter contact and completion photos (mirror can_handle_report)', () => {
  it('never offers contact details to dispatchers or platform admins', () => {
    expect(canViewReporterContact('intake_dispatcher')).toBe(false);
    expect(canViewReporterContact('platform_admin')).toBe(false);
    expect(canViewReporterContact('employee')).toBe(true);
  });

  it('allows completion photos while in progress or resolved, up to five', () => {
    expect(completionUpload('employee', 'in_progress', 0)).toEqual({ allowed: true, remaining: 5 });
    expect(completionUpload('employee', 'assigned', 0)).toMatchObject({
      allowed: false,
      reason: 'status',
    });
    expect(completionUpload('employee', 'resolved', 5)).toMatchObject({
      allowed: false,
      reason: 'limit',
    });
    expect(completionUpload('intake_dispatcher', 'in_progress', 0)).toMatchObject({
      allowed: false,
      reason: 'role',
    });
  });
});

describe('workflow messages', () => {
  it('explains every database refusal the API recognizes, in every language', () => {
    for (const locale of ['he', 'ar', 'en'] as const) {
      for (const issue of Object.keys(STAFF_WORKFLOW_MESSAGES)) {
        expect(
          (messages[locale].adminReports.issues as Record<string, string>)[issue],
          `${locale}: ${issue}`,
        ).toBeTruthy();
      }
    }
  });
});
