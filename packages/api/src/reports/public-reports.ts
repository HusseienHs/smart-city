import { z } from 'zod';

import type { SmartCityClient } from '../client';
import type { Database } from '../database.types';
import { runListQuery } from '../utils/query';
import { requireUserId } from '../utils/session';
import { parseInput } from '../utils/validation';

/*
 * Public reports on the map (`get_public_reports`). Signed-in users only (anon has no EXECUTE).
 *
 * What the database returns is already safe to show anyone signed in: only public, non-duplicate,
 * non-rejected reports of an *active* municipality, resolved ones for 30 days; the location is
 * the ~50 m grid point (never the exact one); no reporter, description, address or photos.
 */

type PublicReportRow = Database['public']['Functions']['get_public_reports']['Returns'][number];
export type PublicReport = PublicReportRow;

/** The function refuses wider areas (degrees of latitude / longitude). */
export const PUBLIC_REPORTS_MAX_SPAN = 0.5;
export const PUBLIC_REPORTS_MAX_LIMIT = 500;

const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);

const publicReportsSchema = z
  .strictObject({
    municipalityId: z.uuid(),
    south: latitude,
    west: longitude,
    north: latitude,
    east: longitude,
    limit: z.number().int().min(1).max(PUBLIC_REPORTS_MAX_LIMIT).optional(),
  })
  .refine((area) => area.north > area.south && area.east > area.west, {
    message: 'The area must have a positive size',
  })
  .refine(
    (area) =>
      area.north - area.south <= PUBLIC_REPORTS_MAX_SPAN &&
      area.east - area.west <= PUBLIC_REPORTS_MAX_SPAN,
    { message: 'The area is too large' },
  );
export type PublicReportsArea = z.input<typeof publicReportsSchema>;

/** Public reports of one municipality inside a map area, newest first. */
export async function getPublicReports(
  client: SmartCityClient,
  input: PublicReportsArea,
): Promise<PublicReport[]> {
  const area = parseInput(publicReportsSchema, input);
  await requireUserId(client);
  const rows = await runListQuery(
    client.rpc('get_public_reports', {
      p_municipality_id: area.municipalityId,
      p_south: area.south,
      p_west: area.west,
      p_north: area.north,
      p_east: area.east,
      ...(area.limit ? { p_limit: area.limit } : {}),
    }),
  );
  // Defense in depth: only the requested municipality.
  return rows.filter((row) => row.municipality_id === area.municipalityId);
}
