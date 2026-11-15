/**
 * Explicit column lists for staff report queries. `select *` is never used: the database refuses
 * it (column-level grants), and these lists document exactly what staff can read.
 *
 * Only columns granted to `authenticated` in supabase/migrations/20261103000400_reports.sql
 * appear here. Never add the identity columns the database hides from every API role
 * (REPORT_HIDDEN_COLUMNS): they would identify the reporter or the uploader.
 *
 * Exported so `supabase/tests` can run these exact lists against the real grants and policies.
 */

/** Columns the database deliberately does not grant to API roles. Listed for tests. */
export const REPORT_HIDDEN_COLUMNS = [
  'reporter_id',
  'author_id',
  'changed_by',
  'uploaded_by',
] as const;

/**
 * One row of the staff reports list. No location: the exact location is only loaded with the
 * details of a single report.
 */
export const STAFF_REPORT_LIST_COLUMNS =
  'id, municipality_id, tracking_number, category_id, neighborhood_id, description, address, visibility, status, priority, suggested_department_id, department_id, assignee_id, confirmation_count, follower_count, status_changed_at, first_response_at, resolved_at, closed_at, created_at, updated_at' as const;

/** Everything staff may read about one report, including its exact location (hex EWKB). */
export const STAFF_REPORT_DETAIL_COLUMNS =
  `${STAFF_REPORT_LIST_COLUMNS}, location, location_accuracy_m, rejection_reason, duplicate_of_id` as const;

export const STAFF_REPORT_ATTACHMENT_COLUMNS =
  'id, report_id, municipality_id, kind, storage_path, mime_type, size_bytes, created_at' as const;

export const STAFF_REPORT_COMMENT_COLUMNS =
  'id, report_id, municipality_id, author_employee_id, from_reporter, body, is_internal, created_at' as const;

export const STAFF_REPORT_HISTORY_COLUMNS =
  'id, report_id, municipality_id, from_status, to_status, changed_by_employee_id, note, note_is_public, created_at' as const;
