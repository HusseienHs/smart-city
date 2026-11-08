/**
 * What the citizen can report, from the backend (via @smart-city/api):
 * the categories enabled in the chosen municipality, and the user's home municipality.
 */
import {
  getMyProfile,
  listMunicipalityReportCategories,
  type MunicipalityReportCategory,
} from '@smart-city/api';
import { REPORT_CATEGORIES, type ReportCategory } from '@smart-city/shared';

// Relative (not '@/'), so the unit tests can load this module.
import { useAsync } from '../hooks/use-async';

import { getSupabase } from './supabase';

/**
 * The enabled categories this app version can send, in the municipality's order. Codes the
 * app doesn't know yet are left out: `submitReport` only accepts the shared categories.
 */
export function offeredCategories(rows: readonly MunicipalityReportCategory[]): ReportCategory[] {
  const known = new Set<string>(REPORT_CATEGORIES);
  const offered: ReportCategory[] = [];
  for (const row of rows) {
    const code = row.category.code;
    if (known.has(code) && !offered.includes(code as ReportCategory)) {
      offered.push(code as ReportCategory);
    }
  }
  return offered;
}

export function useReportCategories(municipalityId: string | null) {
  return useAsync<ReportCategory[]>(municipalityId, async () =>
    offeredCategories(
      await listMunicipalityReportCategories(getSupabase(), { municipalityId: municipalityId! }),
    ),
  );
}

/** The signed-in user's home municipality (null when none is set). */
export function useHomeMunicipalityId(userId: string | null) {
  return useAsync<string | null>(
    userId,
    async () => (await getMyProfile(getSupabase()))?.home_municipality_id ?? null,
  );
}
