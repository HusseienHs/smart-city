import type { LocalizedText } from '@smart-city/shared';
import { z } from 'zod';

import type { SmartCityClient } from '../client';
import { REPORT_CATEGORY_COLUMNS } from '../reference-data/columns';
import { runListQuery } from '../utils/query';
import { requireUserId } from '../utils/session';
import { parseInput, toLocalizedText } from '../utils/validation';

/*
 * The names staff need to read and filter reports: departments and neighborhoods of their
 * municipality (including inactive ones, so older reports still show a name) and the report
 * categories. RLS lets staff read their own municipality's rows; the explicit municipality
 * filter keeps lists of multi-municipality staff separate.
 */

export const STAFF_DEPARTMENT_COLUMNS = 'id, municipality_id, name, is_active' as const;
export const STAFF_NEIGHBORHOOD_COLUMNS = 'id, municipality_id, name, is_active' as const;

export interface StaffDirectoryEntry {
  id: string;
  name: LocalizedText;
  isActive: boolean;
}

export interface StaffCategoryEntry {
  id: string;
  code: string;
  name: LocalizedText;
}

export interface StaffDirectory {
  departments: StaffDirectoryEntry[];
  neighborhoods: StaffDirectoryEntry[];
  categories: StaffCategoryEntry[];
}

const scopeSchema = z.strictObject({ municipalityId: z.uuid() });

export async function getStaffDirectory(
  client: SmartCityClient,
  input: z.input<typeof scopeSchema>,
): Promise<StaffDirectory> {
  const { municipalityId } = parseInput(scopeSchema, input);
  await requireUserId(client);
  const [departments, neighborhoods, categories] = await Promise.all([
    runListQuery(
      client
        .from('departments')
        .select(STAFF_DEPARTMENT_COLUMNS)
        .eq('municipality_id', municipalityId)
        .order('created_at'),
    ),
    runListQuery(
      client
        .from('neighborhoods')
        .select(STAFF_NEIGHBORHOOD_COLUMNS)
        .eq('municipality_id', municipalityId)
        .order('created_at'),
    ),
    runListQuery(
      client.from('report_categories').select(REPORT_CATEGORY_COLUMNS).order('sort_order'),
    ),
  ]);
  const entry = (row: { id: string; name: unknown; is_active: boolean }): StaffDirectoryEntry => ({
    id: row.id,
    name: toLocalizedText(row.name as never),
    isActive: row.is_active,
  });
  return {
    departments: departments.map(entry),
    neighborhoods: neighborhoods.map(entry),
    categories: categories.map((row) => ({
      id: row.id,
      code: row.code,
      name: toLocalizedText(row.name),
    })),
  };
}
