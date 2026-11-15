import {
  STAFF_REPORT_SEARCH_MAX_LENGTH,
  STAFF_REPORT_SORT_FIELDS,
  type ListStaffReportsInput,
  type StaffReportSortField,
} from '@smart-city/api';
import {
  REPORT_PRIORITIES,
  REPORT_STATUSES,
  type ReportPriority,
  type ReportStatus,
} from '@smart-city/shared';

/**
 * The reports list state lives in the URL (`/reports?status=submitted&page=2`), so a view can be
 * bookmarked, shared and reloaded, and the filter form works without JavaScript.
 *
 * Parsing is strict but forgiving: an unknown or malformed value is dropped (and reported, so
 * the page can say so), never passed on. The API validates everything again.
 */

export type AssignmentFilter = 'me' | 'unassigned';

export interface ReportFilters {
  search?: string;
  statuses: ReportStatus[];
  priorities: ReportPriority[];
  departmentId?: string;
  categoryId?: string;
  neighborhoodId?: string;
  assignment?: AssignmentFilter;
  /** Calendar days (YYYY-MM-DD) in the municipality's time zone, inclusive. */
  from?: string;
  to?: string;
  sort: StaffReportSortField;
  direction: 'asc' | 'desc';
  page: number;
}

export const DEFAULT_SORT: StaffReportSortField = 'created_at';
export const DEFAULT_DIRECTION = 'desc';
export const MAX_PAGE = 10_000;

/** Every municipality on the platform is in Israel. */
export const MUNICIPAL_TIME_ZONE = 'Asia/Jerusalem';

type SearchParams = Readonly<Record<string, string | string[] | undefined>>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

const all = (value: string | string[] | undefined): string[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];
const first = (value: string | string[] | undefined): string | undefined => all(value)[0];

export function isCalendarDay(value: string): boolean {
  const match = DAY.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export interface ParsedFilters {
  filters: ReportFilters;
  /** Some values in the URL were invalid and were ignored. */
  invalid: boolean;
}

export function parseReportFilters(params: SearchParams): ParsedFilters {
  let invalid = false;
  const pick = <T extends string>(values: string[], allowed: readonly T[]): T[] => {
    const kept = [
      ...new Set(values.filter((v): v is T => (allowed as readonly string[]).includes(v))),
    ];
    if (kept.length !== new Set(values).size) invalid = true;
    return kept;
  };
  const id = (name: string): string | undefined => {
    const value = first(params[name]);
    if (!value) return undefined;
    if (UUID.test(value)) return value.toLowerCase();
    invalid = true;
    return undefined;
  };
  const day = (name: string): string | undefined => {
    const value = first(params[name]);
    if (!value) return undefined;
    if (isCalendarDay(value)) return value;
    invalid = true;
    return undefined;
  };

  const search = first(params.q)?.trim().slice(0, STAFF_REPORT_SEARCH_MAX_LENGTH) || undefined;

  const assignmentValue = first(params.assignment);
  let assignment: AssignmentFilter | undefined;
  if (assignmentValue === 'me' || assignmentValue === 'unassigned') assignment = assignmentValue;
  else if (assignmentValue) invalid = true;

  const sortValue = first(params.sort);
  let sort = DEFAULT_SORT;
  if (sortValue && (STAFF_REPORT_SORT_FIELDS as readonly string[]).includes(sortValue)) {
    sort = sortValue as StaffReportSortField;
  } else if (sortValue) invalid = true;

  const dirValue = first(params.dir);
  let direction: 'asc' | 'desc' = DEFAULT_DIRECTION;
  if (dirValue === 'asc' || dirValue === 'desc') direction = dirValue;
  else if (dirValue) invalid = true;

  const pageValue = first(params.page);
  let page = 1;
  if (pageValue) {
    const parsed = Number(pageValue);
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_PAGE) page = parsed;
    else invalid = true;
  }

  let from = day('from');
  let to = day('to');
  if (from && to && from > to) {
    invalid = true;
    [from, to] = [undefined, undefined];
  }

  return {
    filters: {
      search,
      statuses: pick(all(params.status), REPORT_STATUSES),
      priorities: pick(all(params.priority), REPORT_PRIORITIES),
      departmentId: id('department'),
      categoryId: id('category'),
      neighborhoodId: id('neighborhood'),
      assignment,
      from,
      to,
      sort,
      direction,
      page,
    },
    invalid,
  };
}

/** The UTC offset of `timeZone` at `instant`, in minutes (e.g. +180 for Israel in summer). */
function offsetMinutes(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const local = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return Math.round((local - instant) / 60_000);
}

/** The instant a calendar day starts (00:00) in `timeZone`, as an ISO string in UTC. */
export function startOfDay(day: string, timeZone = MUNICIPAL_TIME_ZONE): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const utcMidnight = Date.UTC(y, m - 1, d);
  // Two passes settle the offset correctly around daylight-saving changes.
  let instant = utcMidnight - offsetMinutes(utcMidnight, timeZone) * 60_000;
  instant = utcMidnight - offsetMinutes(instant, timeZone) * 60_000;
  return new Date(instant).toISOString();
}

/** The last millisecond of a calendar day in `timeZone`, as an ISO string in UTC. */
export function endOfDay(day: string, timeZone = MUNICIPAL_TIME_ZONE): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  return new Date(Date.parse(startOfDay(next, timeZone)) - 1).toISOString();
}

/** The API input for these filters in the active municipality. */
export function toListInput(
  filters: ReportFilters,
  municipalityId: string,
  pageSize: number,
): ListStaffReportsInput {
  return {
    municipalityId,
    search: filters.search,
    statuses: filters.statuses,
    priorities: filters.priorities,
    departmentId: filters.departmentId,
    categoryId: filters.categoryId,
    neighborhoodId: filters.neighborhoodId,
    assignedToMe: filters.assignment === 'me' || undefined,
    unassigned: filters.assignment === 'unassigned' || undefined,
    createdFrom: filters.from ? startOfDay(filters.from) : undefined,
    createdTo: filters.to ? endOfDay(filters.to) : undefined,
    sort: filters.sort,
    direction: filters.direction,
    page: filters.page,
    pageSize,
  };
}

/** The filters that narrow the list (not sorting or paging), for "active filters" chips. */
export type FilterKey =
  | 'search'
  | 'statuses'
  | 'priorities'
  | 'departmentId'
  | 'categoryId'
  | 'neighborhoodId'
  | 'assignment'
  | 'from'
  | 'to';

export function activeFilterKeys(filters: ReportFilters): FilterKey[] {
  const keys: FilterKey[] = [];
  if (filters.search) keys.push('search');
  if (filters.statuses.length > 0) keys.push('statuses');
  if (filters.priorities.length > 0) keys.push('priorities');
  if (filters.departmentId) keys.push('departmentId');
  if (filters.categoryId) keys.push('categoryId');
  if (filters.neighborhoodId) keys.push('neighborhoodId');
  if (filters.assignment) keys.push('assignment');
  if (filters.from) keys.push('from');
  if (filters.to) keys.push('to');
  return keys;
}

/**
 * The query string for these filters, with `changes` applied. Defaults are left out so URLs stay
 * short. Changing anything other than the page goes back to page 1.
 */
export function filtersQuery(filters: ReportFilters, changes: Partial<ReportFilters> = {}): string {
  const next: ReportFilters = { ...filters, ...changes };
  if (!('page' in changes)) next.page = 1;
  const params = new URLSearchParams();
  if (next.search) params.set('q', next.search);
  for (const status of next.statuses) params.append('status', status);
  for (const priority of next.priorities) params.append('priority', priority);
  if (next.departmentId) params.set('department', next.departmentId);
  if (next.categoryId) params.set('category', next.categoryId);
  if (next.neighborhoodId) params.set('neighborhood', next.neighborhoodId);
  if (next.assignment) params.set('assignment', next.assignment);
  if (next.from) params.set('from', next.from);
  if (next.to) params.set('to', next.to);
  if (next.sort !== DEFAULT_SORT) params.set('sort', next.sort);
  if (next.direction !== DEFAULT_DIRECTION) params.set('dir', next.direction);
  if (next.page > 1) params.set('page', String(next.page));
  const query = params.toString();
  return query ? `?${query}` : '';
}

/** Filters with one active filter removed. */
export function withoutFilter(filters: ReportFilters, key: FilterKey): Partial<ReportFilters> {
  switch (key) {
    case 'statuses':
    case 'priorities':
      return { [key]: [] };
    default:
      return { [key]: undefined };
  }
}

/** Sorting by a column: the same column flips direction, a new one starts descending. */
export function sortChange(
  filters: ReportFilters,
  column: StaffReportSortField,
): Partial<ReportFilters> {
  if (filters.sort === column) {
    return { sort: column, direction: filters.direction === 'asc' ? 'desc' : 'asc' };
  }
  return { sort: column, direction: 'desc' };
}
