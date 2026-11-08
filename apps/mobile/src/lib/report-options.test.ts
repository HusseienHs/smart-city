import type { Municipality, MunicipalityReportCategory } from '@smart-city/api';
import { describe, expect, it, vi } from 'vitest';

import { homeCityNotJoined, offeredCategories } from './report-options';

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

describe('homeCityNotJoined', () => {
  const city = (id: string, status: Municipality['status']): Municipality => ({
    id,
    code: id.toUpperCase(),
    name: { he: id },
    status,
    default_locale: 'he',
    timezone: 'Asia/Jerusalem',
    contact_email: null,
    contact_phone: null,
  });
  const joined = city('dmn', 'active');
  const haifa = city('hfa', 'onboarding');

  it('returns the home city when it has not joined', () => {
    expect(homeCityNotJoined('hfa', [joined], [joined, haifa])).toBe(haifa);
  });

  it('returns null when the home city accepts reports', () => {
    expect(homeCityNotJoined('dmn', [joined], [joined, haifa])).toBeNull();
  });

  it('returns null without a home city or while a list is loading', () => {
    expect(homeCityNotJoined(null, [joined], [joined, haifa])).toBeNull();
    expect(homeCityNotJoined('hfa', null, [joined, haifa])).toBeNull();
    expect(homeCityNotJoined('hfa', [joined], null)).toBeNull();
  });
});
