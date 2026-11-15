import { describe, expect, it } from 'vitest';

import {
  REPORT_HIDDEN_COLUMNS,
  STAFF_REPORT_ATTACHMENT_COLUMNS,
  STAFF_REPORT_COMMENT_COLUMNS,
  STAFF_REPORT_DETAIL_COLUMNS,
  STAFF_REPORT_HISTORY_COLUMNS,
  STAFF_REPORT_LIST_COLUMNS,
} from './report-columns';

const columns = (list: string) => list.split(',').map((column) => column.trim());

/**
 * The column grants to `authenticated`, copied from supabase/migrations/20261103000400_reports.sql.
 * supabase/tests/staff-report-api.test.ts runs the lists against the real database too.
 */
const GRANTED = {
  reports: [
    'id',
    'municipality_id',
    'tracking_number',
    'category_id',
    'neighborhood_id',
    'description',
    'location',
    'public_location',
    'location_accuracy_m',
    'address',
    'visibility',
    'status',
    'priority',
    'suggested_department_id',
    'department_id',
    'assignee_id',
    'rejection_reason',
    'duplicate_of_id',
    'confirmation_count',
    'follower_count',
    'status_changed_at',
    'first_response_at',
    'resolved_at',
    'closed_at',
    'created_at',
    'updated_at',
  ],
  report_attachments: [
    'id',
    'report_id',
    'municipality_id',
    'kind',
    'storage_path',
    'mime_type',
    'size_bytes',
    'created_at',
  ],
  report_comments: [
    'id',
    'report_id',
    'municipality_id',
    'author_employee_id',
    'from_reporter',
    'body',
    'is_internal',
    'created_at',
  ],
  report_status_history: [
    'id',
    'report_id',
    'municipality_id',
    'from_status',
    'to_status',
    'changed_by_employee_id',
    'note',
    'note_is_public',
    'created_at',
  ],
};

const LISTS: [string, string, readonly string[]][] = [
  ['list', STAFF_REPORT_LIST_COLUMNS, GRANTED.reports],
  ['detail', STAFF_REPORT_DETAIL_COLUMNS, GRANTED.reports],
  ['attachments', STAFF_REPORT_ATTACHMENT_COLUMNS, GRANTED.report_attachments],
  ['comments', STAFF_REPORT_COMMENT_COLUMNS, GRANTED.report_comments],
  ['history', STAFF_REPORT_HISTORY_COLUMNS, GRANTED.report_status_history],
];

describe('staff report column lists', () => {
  it.each(LISTS)('%s: explicit, granted columns only, no duplicates', (_name, list, granted) => {
    const names = columns(list);
    expect(list).not.toContain('*');
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) {
      expect(name).toMatch(/^[a-z_]+$/);
      expect(granted).toContain(name);
    }
  });

  it.each(LISTS)('%s: never includes a hidden identity column', (_name, list) => {
    for (const hidden of REPORT_HIDDEN_COLUMNS) expect(columns(list)).not.toContain(hidden);
  });

  it('the list never loads the exact location; the details do', () => {
    expect(columns(STAFF_REPORT_LIST_COLUMNS)).not.toContain('location');
    expect(columns(STAFF_REPORT_LIST_COLUMNS)).not.toContain('public_location');
    expect(columns(STAFF_REPORT_DETAIL_COLUMNS)).toContain('location');
  });

  it('every list is scoped by municipality (for the explicit tenant filter)', () => {
    for (const [, list] of LISTS) expect(columns(list)).toContain('municipality_id');
  });
});
