import { describe, expect, it } from 'vitest';

import {
  activeFilterKeys,
  endOfDay,
  filtersQuery,
  parseReportFilters,
  sortChange,
  startOfDay,
  toListInput,
  withoutFilter,
} from './filters';

const deptId = '8b3c4d5e-2f3a-4b5c-9d0e-1f2a3b4c5d6e';
const muni = '7a2b3c4d-1e2f-4a5b-8c9d-0e1f2a3b4c5d';

describe('parseReportFilters', () => {
  it('has sensible defaults', () => {
    const { filters, invalid } = parseReportFilters({});
    expect(invalid).toBe(false);
    expect(filters).toEqual({
      search: undefined,
      statuses: [],
      priorities: [],
      departmentId: undefined,
      categoryId: undefined,
      neighborhoodId: undefined,
      assignment: undefined,
      from: undefined,
      to: undefined,
      sort: 'created_at',
      direction: 'desc',
      page: 1,
    });
  });

  it('reads every filter, including repeated statuses and priorities', () => {
    const { filters, invalid } = parseReportFilters({
      q: '  pothole  ',
      status: ['submitted', 'in_progress', 'submitted'],
      priority: 'urgent',
      department: deptId.toUpperCase(),
      assignment: 'unassigned',
      from: '2026-03-01',
      to: '2026-03-31',
      sort: 'priority',
      dir: 'asc',
      page: '3',
    });
    expect(invalid).toBe(false);
    expect(filters).toMatchObject({
      search: 'pothole',
      statuses: ['submitted', 'in_progress'],
      priorities: ['urgent'],
      departmentId: deptId,
      assignment: 'unassigned',
      from: '2026-03-01',
      to: '2026-03-31',
      sort: 'priority',
      direction: 'asc',
      page: 3,
    });
  });

  it('drops and reports anything malformed instead of passing it on', () => {
    const { filters, invalid } = parseReportFilters({
      status: ['submitted', 'deleted'],
      department: "x' or 1=1",
      assignment: 'everyone',
      sort: 'reporter_id',
      dir: 'sideways',
      page: '-2',
      from: '2026-02-30',
    });
    expect(invalid).toBe(true);
    expect(filters).toMatchObject({
      statuses: ['submitted'],
      departmentId: undefined,
      assignment: undefined,
      sort: 'created_at',
      direction: 'desc',
      page: 1,
      from: undefined,
    });
  });

  it('ignores a date range that ends before it starts', () => {
    const { filters, invalid } = parseReportFilters({ from: '2026-05-02', to: '2026-05-01' });
    expect(invalid).toBe(true);
    expect(filters.from).toBeUndefined();
    expect(filters.to).toBeUndefined();
  });

  it('limits the search length', () => {
    expect(parseReportFilters({ q: 'x'.repeat(500) }).filters.search).toHaveLength(100);
  });
});

describe('municipal days', () => {
  it('converts calendar days in Israel to UTC instants, across daylight saving', () => {
    // Winter: UTC+2.
    expect(startOfDay('2026-01-15')).toBe('2026-01-14T22:00:00.000Z');
    expect(endOfDay('2026-01-15')).toBe('2026-01-15T21:59:59.999Z');
    // Summer: UTC+3.
    expect(startOfDay('2026-07-15')).toBe('2026-07-14T21:00:00.000Z');
    expect(endOfDay('2026-07-15')).toBe('2026-07-15T20:59:59.999Z');
  });
});

describe('toListInput', () => {
  it('maps the URL filters to the API input of the active municipality', () => {
    const { filters } = parseReportFilters({
      assignment: 'me',
      from: '2026-01-15',
      to: '2026-01-15',
      page: '2',
    });
    expect(toListInput(filters, muni, 25)).toMatchObject({
      municipalityId: muni,
      assignedToMe: true,
      unassigned: undefined,
      createdFrom: '2026-01-14T22:00:00.000Z',
      createdTo: '2026-01-15T21:59:59.999Z',
      page: 2,
      pageSize: 25,
    });
  });
});

describe('links', () => {
  const { filters } = parseReportFilters({ status: 'submitted', q: 'lamp', page: '4' });

  it('keeps URLs short and resets the page when filters change', () => {
    expect(filtersQuery(filters)).toBe('?q=lamp&status=submitted');
    expect(filtersQuery(filters, { page: 5 })).toBe('?q=lamp&status=submitted&page=5');
    expect(filtersQuery(filters, withoutFilter(filters, 'statuses'))).toBe('?q=lamp');
    expect(filtersQuery(filters, withoutFilter(filters, 'search'))).toBe('?status=submitted');
  });

  it('flips the direction of the current sort column, and starts new columns descending', () => {
    expect(sortChange(filters, 'created_at')).toEqual({ sort: 'created_at', direction: 'asc' });
    expect(sortChange(filters, 'priority')).toEqual({ sort: 'priority', direction: 'desc' });
    expect(filtersQuery(filters, sortChange(filters, 'created_at'))).toBe(
      '?q=lamp&status=submitted&dir=asc',
    );
  });

  it('lists the active filters', () => {
    expect(activeFilterKeys(filters)).toEqual(['search', 'statuses']);
  });
});
