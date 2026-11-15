import {
  isValidTrackingNumber,
  MUNICIPAL_STAFF_ROLES,
  normalizeTrackingNumber,
  REPORT_PRIORITIES,
  REPORT_STATUSES,
} from '@smart-city/shared';
import { z } from 'zod';

import type { SmartCityClient } from '../client';
import type { Database, Enums, Tables } from '../database.types';
import { isApiError } from '../errors/api-error';
import { toGeoPoint, type GeoPoint } from '../utils/geo';
import { runCountedListQuery, runListQuery, runMaybeSingleQuery } from '../utils/query';
import { requireUserId } from '../utils/session';
import { parseInput } from '../utils/validation';
import {
  STAFF_REPORT_ATTACHMENT_COLUMNS,
  STAFF_REPORT_COMMENT_COLUMNS,
  STAFF_REPORT_DETAIL_COLUMNS,
  STAFF_REPORT_HISTORY_COLUMNS,
  STAFF_REPORT_LIST_COLUMNS,
} from './report-columns';
import { getMyStaffMemberships } from './staff';

/*
 * Staff-facing report reads. Every call acts as the signed-in staff member (publishable key +
 * their session); Row Level Security decides which reports exist for them:
 * private.can_access_report() — admin: the municipality; manager: their department; employee:
 * reports assigned to them; dispatcher: the unassigned intake queue.
 *
 * On top of that, every query is explicitly scoped to ONE municipality (the active one). Staff
 * of several municipalities would otherwise see a mixed list. The filter narrows; it never
 * grants anything.
 *
 * Reporter identity is never read here: `reporter_id` and the other identity columns are not
 * granted, and reporter contact details are only available through get_report_reporter_contact()
 * (audited, handlers only). Nothing is cached across requests.
 */

// ---------------------------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------------------------

export const STAFF_REPORT_SORT_FIELDS = [
  'created_at',
  'status_changed_at',
  'updated_at',
  'priority',
  'status',
] as const;
export type StaffReportSortField = (typeof STAFF_REPORT_SORT_FIELDS)[number];

export const STAFF_REPORT_MAX_PAGE_SIZE = 100;
export const STAFF_REPORT_DEFAULT_PAGE_SIZE = 25;
export const STAFF_REPORT_SEARCH_MAX_LENGTH = 100;

const listStaffReportsSchema = z
  .strictObject({
    /** The active municipality. Required: lists are never mixed across municipalities. */
    municipalityId: z.uuid(),
    /** Any of these statuses; omitted or empty = every status. */
    statuses: z.array(z.enum(REPORT_STATUSES)).max(REPORT_STATUSES.length).optional(),
    /** Any of these priorities; omitted or empty = every priority. */
    priorities: z.array(z.enum(REPORT_PRIORITIES)).max(REPORT_PRIORITIES.length).optional(),
    departmentId: z.uuid().optional(),
    categoryId: z.uuid().optional(),
    neighborhoodId: z.uuid().optional(),
    /** Only reports assigned to the caller's own membership in this municipality. */
    assignedToMe: z.boolean().optional(),
    /** Only reports without an assignee. */
    unassigned: z.boolean().optional(),
    /** Created at or after this instant (ISO 8601 with offset). */
    createdFrom: z.iso.datetime({ offset: true }).optional(),
    /** Created at or before this instant (ISO 8601 with offset). */
    createdTo: z.iso.datetime({ offset: true }).optional(),
    /** A tracking number (exact match) or text found in the description or address. */
    search: z.string().trim().max(STAFF_REPORT_SEARCH_MAX_LENGTH).optional(),
    sort: z.enum(STAFF_REPORT_SORT_FIELDS).default('created_at'),
    direction: z.enum(['asc', 'desc']).default('desc'),
    page: z.number().int().min(1).max(10_000).default(1),
    pageSize: z
      .number()
      .int()
      .min(1)
      .max(STAFF_REPORT_MAX_PAGE_SIZE)
      .default(STAFF_REPORT_DEFAULT_PAGE_SIZE),
  })
  .refine((value) => !(value.assignedToMe && value.unassigned), {
    message: 'assignedToMe and unassigned exclude each other',
    path: ['unassigned'],
  })
  .refine(
    (value) =>
      !value.createdFrom ||
      !value.createdTo ||
      Date.parse(value.createdFrom) <= Date.parse(value.createdTo),
    { message: 'createdFrom must not be after createdTo', path: ['createdTo'] },
  );

export type ListStaffReportsInput = z.input<typeof listStaffReportsSchema>;

type ReportRow = Tables<'reports'>;

/** One report in the staff list. No location and nothing that identifies the reporter. */
export type StaffReportSummary = Pick<
  ReportRow,
  | 'id'
  | 'municipality_id'
  | 'tracking_number'
  | 'category_id'
  | 'neighborhood_id'
  | 'description'
  | 'address'
  | 'visibility'
  | 'status'
  | 'priority'
  | 'suggested_department_id'
  | 'department_id'
  | 'assignee_id'
  | 'confirmation_count'
  | 'follower_count'
  | 'status_changed_at'
  | 'first_response_at'
  | 'resolved_at'
  | 'closed_at'
  | 'created_at'
  | 'updated_at'
>;

export interface StaffReportPage {
  items: StaffReportSummary[];
  /** Every report matching the filters that the caller may see, across all pages. */
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/**
 * Makes user text safe inside a PostgREST `ilike` pattern within an `or=(…)` filter:
 * 1. `\`, `%` and `_` are escaped for LIKE, so they match literally;
 * 2. `*` is removed — PostgREST turns it into a `%` wildcard and it can't be escaped;
 * 3. the pattern is double-quoted, with `\` and `"` escaped, so `,`, `.`, `:` and parentheses
 *    can't break out of the filter.
 */
export function toSearchPattern(term: string): string {
  const literal = term.replace(/\*/g, ' ').replace(/[\\%_]/g, (char) => `\\${char}`);
  const pattern = `%${literal}%`;
  return `"${pattern.replace(/[\\"]/g, (char) => `\\${char}`)}"`;
}

const unique = <T>(values: readonly T[] | undefined): T[] => [...new Set(values ?? [])];

/**
 * The reports of one municipality that the caller may see, filtered, sorted and paginated, with
 * the exact total. A page past the end is an empty page (with the real total), not an error.
 */
export async function listStaffReports(
  client: SmartCityClient,
  input: ListStaffReportsInput,
): Promise<StaffReportPage> {
  const filters = parseInput(listStaffReportsSchema, input);
  await requireUserId(client);
  const { page, pageSize } = filters;

  let assigneeId: string | undefined;
  if (filters.assignedToMe) {
    // assignee_id references the membership row (employees.id), not the user id.
    const memberships = await getMyStaffMemberships(client);
    const own = memberships.find((m) => m.municipality_id === filters.municipalityId);
    if (!own) return { items: [], total: 0, page, pageSize, pageCount: 0 };
    assigneeId = own.employee_id;
  }

  const search = filters.search ? filters.search : undefined;
  const trackingNumber =
    search && isValidTrackingNumber(normalizeTrackingNumber(search))
      ? normalizeTrackingNumber(search)
      : undefined;

  // Built twice at most (rows, then — only past the last page — the count alone), with the
  // same filters each time.
  const build = (columns: string, options: { head?: boolean }) => {
    let query = client
      .from('reports')
      .select(columns, { count: 'exact', head: options.head ?? false })
      .eq('municipality_id', filters.municipalityId);
    const statuses = unique(filters.statuses);
    if (statuses.length > 0) query = query.in('status', statuses);
    const priorities = unique(filters.priorities);
    if (priorities.length > 0) query = query.in('priority', priorities);
    if (filters.departmentId) query = query.eq('department_id', filters.departmentId);
    if (filters.categoryId) query = query.eq('category_id', filters.categoryId);
    if (filters.neighborhoodId) query = query.eq('neighborhood_id', filters.neighborhoodId);
    if (assigneeId) query = query.eq('assignee_id', assigneeId);
    if (filters.unassigned) query = query.is('assignee_id', null);
    if (filters.createdFrom) query = query.gte('created_at', filters.createdFrom);
    if (filters.createdTo) query = query.lte('created_at', filters.createdTo);
    if (trackingNumber) {
      query = query.eq('tracking_number', trackingNumber);
    } else if (search) {
      const pattern = toSearchPattern(search);
      query = query.or(`description.ilike.${pattern},address.ilike.${pattern}`);
    }
    return query;
  };

  const from = (page - 1) * pageSize;
  try {
    const { rows, total } = await runCountedListQuery(
      build(STAFF_REPORT_LIST_COLUMNS, {})
        .order(filters.sort, { ascending: filters.direction === 'asc' })
        // A unique tie-breaker keeps pages stable when many rows share the sort value.
        .order('id', { ascending: filters.direction === 'asc' })
        .range(from, from + pageSize - 1),
    );
    return {
      items: rows as unknown as StaffReportSummary[],
      total,
      page,
      pageSize,
      pageCount: Math.ceil(total / pageSize),
    };
  } catch (error) {
    // PostgREST answers 416 / PGRST103 when the offset is past the last row.
    if (!isApiError(error) || error.debug.code !== 'PGRST103') throw error;
    const { total } = await runCountedListQuery(build('id', { head: true }));
    return { items: [], total, page, pageSize, pageCount: Math.ceil(total / pageSize) };
  }
}

// ---------------------------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------------------------

const reportScopeSchema = z.strictObject({
  municipalityId: z.uuid(),
  reportId: z.uuid(),
});
export type StaffReportScope = z.input<typeof reportScopeSchema>;

export interface StaffReport extends StaffReportSummary {
  /** The exact location, decoded from PostGIS. Null only if the stored point is empty. */
  location: GeoPoint | null;
  location_accuracy_m: number | null;
  rejection_reason: Enums<'report_rejection_reason'> | null;
  duplicate_of_id: string | null;
}

export type StaffReportAttachment = Pick<
  Tables<'report_attachments'>,
  | 'id'
  | 'report_id'
  | 'municipality_id'
  | 'kind'
  | 'storage_path'
  | 'mime_type'
  | 'size_bytes'
  | 'created_at'
>;

export type StaffReportComment = Pick<
  Tables<'report_comments'>,
  | 'id'
  | 'report_id'
  | 'municipality_id'
  | 'author_employee_id'
  | 'from_reporter'
  | 'body'
  | 'is_internal'
  | 'created_at'
>;

export type StaffReportHistoryEntry = Pick<
  Tables<'report_status_history'>,
  | 'id'
  | 'report_id'
  | 'municipality_id'
  | 'from_status'
  | 'to_status'
  | 'changed_by_employee_id'
  | 'note'
  | 'note_is_public'
  | 'created_at'
>;

export interface StaffReportDetails {
  report: StaffReport;
  /** Citizen and completion photos, oldest first. `storage_path` is in the private bucket. */
  attachments: StaffReportAttachment[];
  /** Internal and public comments, oldest first. */
  comments: StaffReportComment[];
  /** Status changes, oldest first. */
  history: StaffReportHistoryEntry[];
}

/**
 * One report with its photos, comments and status history — or `null` when it doesn't exist,
 * belongs to another municipality, or the caller may not see it. The three cases are
 * deliberately indistinguishable, so report ids can't be probed.
 */
export async function getStaffReport(
  client: SmartCityClient,
  input: StaffReportScope,
): Promise<StaffReportDetails | null> {
  const { municipalityId, reportId } = parseInput(reportScopeSchema, input);
  await requireUserId(client);

  const row = await runMaybeSingleQuery(
    client
      .from('reports')
      .select(STAFF_REPORT_DETAIL_COLUMNS)
      .eq('id', reportId)
      .eq('municipality_id', municipalityId)
      .maybeSingle(),
  );
  if (!row) return null;

  // Child rows are visible exactly when the report is (RLS); the explicit filters are defense
  // in depth.
  const [attachments, comments, history] = await Promise.all([
    runListQuery(
      client
        .from('report_attachments')
        .select(STAFF_REPORT_ATTACHMENT_COLUMNS)
        .eq('report_id', reportId)
        .eq('municipality_id', municipalityId)
        .order('created_at')
        .order('id'),
    ),
    runListQuery(
      client
        .from('report_comments')
        .select(STAFF_REPORT_COMMENT_COLUMNS)
        .eq('report_id', reportId)
        .eq('municipality_id', municipalityId)
        .order('created_at')
        .order('id'),
    ),
    runListQuery(
      client
        .from('report_status_history')
        .select(STAFF_REPORT_HISTORY_COLUMNS)
        .eq('report_id', reportId)
        .eq('municipality_id', municipalityId)
        .order('created_at')
        .order('id'),
    ),
  ]);

  const { location, ...rest } = row as unknown as Omit<StaffReport, 'location'> & {
    location: unknown;
  };
  return {
    report: { ...rest, location: toGeoPoint(location) },
    attachments: attachments as StaffReportAttachment[],
    comments: comments as StaffReportComment[],
    history: history as StaffReportHistoryEntry[],
  };
}

// ---------------------------------------------------------------------------------------------
// Colleagues
// ---------------------------------------------------------------------------------------------

/** Roles that can be assigned a report (the database enforces the same rule). */
export const ASSIGNABLE_STAFF_ROLES = ['employee', 'department_manager'] as const;

const listColleaguesSchema = z.strictObject({
  municipalityId: z.uuid(),
  /** Only colleagues of this department. */
  departmentId: z.uuid().optional(),
  /** Only colleagues who can be assigned a report (employees and department managers). */
  assignableOnly: z.boolean().optional(),
});
export type ListColleaguesInput = z.input<typeof listColleaguesSchema>;

type ColleagueRow = Database['public']['Functions']['get_colleagues']['Returns'][number];

/** An active colleague. Names come only from this function; no user ids are exposed. */
export interface StaffColleague {
  employee_id: string;
  /** Null when the colleague hasn't set a name. */
  full_name: string | null;
  role: Enums<'staff_role'>;
  department_id: string | null;
  job_title: string | null;
}

/**
 * Active colleagues in a municipality (get_colleagues: callers who aren't active staff there get
 * nothing), optionally only those of one department and/or only those who can be assigned.
 */
export async function listColleagues(
  client: SmartCityClient,
  input: ListColleaguesInput,
): Promise<StaffColleague[]> {
  const { municipalityId, departmentId, assignableOnly } = parseInput(listColleaguesSchema, input);
  await requireUserId(client);

  const rows = await runListQuery(
    client.rpc('get_colleagues', { p_municipality_id: municipalityId }),
  );
  // The generated types mark RPC columns non-null; the SQL returns NULL where they don't apply.
  const colleagues: StaffColleague[] = rows.map((row: ColleagueRow) => ({
    employee_id: row.employee_id,
    full_name: (row.full_name as string | null) ?? null,
    role: row.role,
    department_id: (row.department_id as string | null) ?? null,
    job_title: (row.job_title as string | null) ?? null,
  }));
  return colleagues.filter((colleague) => {
    if (!(MUNICIPAL_STAFF_ROLES as readonly string[]).includes(colleague.role)) return false;
    if (departmentId && colleague.department_id !== departmentId) return false;
    if (assignableOnly && !(ASSIGNABLE_STAFF_ROLES as readonly string[]).includes(colleague.role)) {
      return false;
    }
    return true;
  });
}
