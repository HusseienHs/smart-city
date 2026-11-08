import type { LocalizedText } from '@smart-city/shared';
import { z } from 'zod';

import type { SmartCityClient } from '../client';
import type { Enums } from '../database.types';
import { runListQuery } from '../utils/query';
import { parseInput, toLocalizedText } from '../utils/validation';
import {
  ANNOUNCEMENT_COLUMNS,
  DEPARTMENT_COLUMNS,
  MUNICIPALITY_COLUMNS,
  MUNICIPALITY_REPORT_CATEGORY_SELECT,
  NEIGHBORHOOD_COLUMNS,
  REPORT_CATEGORY_COLUMNS,
} from './columns';

/*
 * Public reference data. Row Level Security is the security boundary; the explicit filters below
 * exist because staff policies also return their own municipality's inactive rows, and these
 * functions should return the same public directory to every caller.
 *
 * Rows keep the database's snake_case names, like the RPC results; only jsonb text is narrowed.
 */

const municipalityScopeSchema = z.object({ municipalityId: z.uuid() });
export type MunicipalityScope = z.input<typeof municipalityScopeSchema>;

export interface Municipality {
  id: string;
  code: string;
  name: LocalizedText;
  status: Enums<'municipality_status'>;
  default_locale: Enums<'app_locale'>;
  timezone: string;
  contact_email: string | null;
  contact_phone: string | null;
}

/**
 * Municipalities that accept reports (status `active`): the choices on the report screen.
 */
export async function listReportingMunicipalities(
  client: SmartCityClient,
): Promise<Municipality[]> {
  const rows = await runListQuery(
    client.from('municipalities').select(MUNICIPALITY_COLUMNS).eq('status', 'active').order('code'),
  );
  return rows.map((row) => ({ ...row, name: toLocalizedText(row.name) }));
}

/**
 * Every listed city a citizen can live in: joined (`active`) and not yet joined (`onboarding`).
 * The choices for the home city at sign-up and in the profile. Sort by localized name in the UI.
 */
export async function listCities(client: SmartCityClient): Promise<Municipality[]> {
  const rows = await runListQuery(
    client
      .from('municipalities')
      .select(MUNICIPALITY_COLUMNS)
      .in('status', ['active', 'onboarding'])
      .order('code'),
  );
  return rows.map((row) => ({ ...row, name: toLocalizedText(row.name) }));
}

/** Whether reports can be sent to this municipality (it has joined the platform). */
export function acceptsReports(municipality: Pick<Municipality, 'status'>): boolean {
  return municipality.status === 'active';
}

export interface Neighborhood {
  id: string;
  municipality_id: string;
  name: LocalizedText;
}

export async function listNeighborhoods(
  client: SmartCityClient,
  input: MunicipalityScope,
): Promise<Neighborhood[]> {
  const { municipalityId } = parseInput(municipalityScopeSchema, input);
  const rows = await runListQuery(
    client
      .from('neighborhoods')
      .select(NEIGHBORHOOD_COLUMNS)
      .eq('municipality_id', municipalityId)
      .eq('is_active', true)
      .order('created_at'),
  );
  return rows.map((row) => ({ ...row, name: toLocalizedText(row.name) }));
}

export interface Department {
  id: string;
  municipality_id: string;
  name: LocalizedText;
  email: string | null;
  phone: string | null;
}

export async function listDepartments(
  client: SmartCityClient,
  input: MunicipalityScope,
): Promise<Department[]> {
  const { municipalityId } = parseInput(municipalityScopeSchema, input);
  const rows = await runListQuery(
    client
      .from('departments')
      .select(DEPARTMENT_COLUMNS)
      .eq('municipality_id', municipalityId)
      .eq('is_active', true)
      .order('created_at'),
  );
  return rows.map((row) => ({ ...row, name: toLocalizedText(row.name) }));
}

export interface ReportCategory {
  id: string;
  /**
   * Deliberately `string`, not the shared union: installed apps lag behind the database, and a
   * category added later must not make the whole list fail to load.
   */
  code: string;
  name: LocalizedText;
  icon: string | null;
  default_visibility: Enums<'report_visibility'>;
  sort_order: number;
}

export async function listReportCategories(client: SmartCityClient): Promise<ReportCategory[]> {
  const rows = await runListQuery(
    client
      .from('report_categories')
      .select(REPORT_CATEGORY_COLUMNS)
      .eq('is_active', true)
      .order('sort_order'),
  );
  return rows.map((row) => ({ ...row, name: toLocalizedText(row.name) }));
}

export interface MunicipalityReportCategory {
  municipality_id: string;
  category_id: string;
  default_priority: Enums<'report_priority'>;
  category: ReportCategory;
}

/** The categories a citizen can report in this municipality, in display order. */
export async function listMunicipalityReportCategories(
  client: SmartCityClient,
  input: MunicipalityScope,
): Promise<MunicipalityReportCategory[]> {
  const { municipalityId } = parseInput(municipalityScopeSchema, input);
  const rows = await runListQuery(
    client
      .from('municipality_report_categories')
      // !inner: a category hidden by RLS (inactive) removes the row instead of returning null.
      .select(MUNICIPALITY_REPORT_CATEGORY_SELECT)
      .eq('municipality_id', municipalityId)
      .eq('is_enabled', true),
  );
  return rows
    .map((row) => ({
      ...row,
      category: { ...row.category, name: toLocalizedText(row.category.name) },
    }))
    .sort((a, b) => a.category.sort_order - b.category.sort_order);
}

/** Public-read bucket where publishers place images of published announcements. */
export const PUBLIC_CONTENT_BUCKET = 'public-content';

/**
 * The public URL of a published announcement's image (`image_path`), or null when it has none.
 * Builds the URL only (no request); the bucket is public-read, so no signed URL is needed.
 * The publisher copies the image after publishing, so the file can briefly be missing: callers
 * should handle a failed image load.
 */
export function announcementImageUrl(
  client: SmartCityClient,
  imagePath: string | null,
): string | null {
  if (!imagePath) return null;
  return client.storage.from(PUBLIC_CONTENT_BUCKET).getPublicUrl(imagePath).data.publicUrl;
}

const DEFAULT_ANNOUNCEMENT_LIMIT = 50;
const MAX_ANNOUNCEMENT_LIMIT = 100;

const publishedAnnouncementsSchema = municipalityScopeSchema.extend({
  /** Also include announcements for this neighborhood; otherwise municipality-wide ones only. */
  neighborhoodId: z.uuid().optional(),
  limit: z.number().int().min(1).max(MAX_ANNOUNCEMENT_LIMIT).default(DEFAULT_ANNOUNCEMENT_LIMIT),
  /** The current time; injectable for tests. */
  now: z.date().optional(),
});
export type PublishedAnnouncementsInput = z.input<typeof publishedAnnouncementsSchema>;

export interface PublishedAnnouncement {
  id: string;
  municipality_id: string;
  department_id: string | null;
  neighborhood_id: string | null;
  title: LocalizedText;
  body: LocalizedText;
  severity: Enums<'announcement_severity'>;
  image_path: string | null;
  expires_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function listPublishedAnnouncements(
  client: SmartCityClient,
  input: PublishedAnnouncementsInput,
): Promise<PublishedAnnouncement[]> {
  const { municipalityId, neighborhoodId, limit, now } = parseInput(
    publishedAnnouncementsSchema,
    input,
  );

  let query = client
    .from('announcements')
    .select(ANNOUNCEMENT_COLUMNS)
    .eq('municipality_id', municipalityId)
    .eq('status', 'published')
    // Staff policies also return expired rows, so filter here as well as in RLS.
    // The timestamp is quoted because `:` and `.` are reserved inside PostgREST `or` filters.
    .or(`expires_at.is.null,expires_at.gt."${(now ?? new Date()).toISOString()}"`);

  // Values interpolated into filter strings are always generated (date) or validated (uuid).
  query = neighborhoodId
    ? query.or(`neighborhood_id.is.null,neighborhood_id.eq.${neighborhoodId}`)
    : query.is('neighborhood_id', null);

  const rows = await runListQuery(query.order('published_at', { ascending: false }).limit(limit));
  return rows.map((row) => ({
    ...row,
    title: toLocalizedText(row.title),
    body: toLocalizedText(row.body),
  }));
}
