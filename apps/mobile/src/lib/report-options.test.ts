import type { MunicipalityReportCategory } from '@smart-city/api';
import { describe, expect, it, vi } from 'vitest';

import { offeredCategories } from './report-options';

vi.mock('./supabase', () => ({ getSupabase: () => ({}) }));

const row = (code: string): MunicipalityReportCategory => ({
  municipality_id: 'm',
  category_id: code,
  default_priority: 'normal',
  category: {
    id: code,
    code,
    name: { he: code },
    icon: null,
    default_visibility: 'public',
    sort_order: 0,
  },
});

describe('offeredCategories', () => {
  it('keeps the municipality’s order and only categories the app can send', () => {
    expect(
      offeredCategories([row('garbage'), row('graffiti'), row('pothole'), row('garbage')]),
    ).toEqual(['garbage', 'pothole']);
    expect(offeredCategories([])).toEqual([]);
  });
});
