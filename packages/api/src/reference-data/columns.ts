/**
 * Explicit column lists for reference-data queries. `select *` is never used: it would fail on
 * tables with column-level grants, and would fetch large PostGIS `boundary` values.
 *
 * Exported so `supabase/tests` can run these exact lists against the real grants and policies.
 */
export const MUNICIPALITY_COLUMNS =
  'id, code, name, status, default_locale, timezone, contact_email, contact_phone' as const;

export const NEIGHBORHOOD_COLUMNS = 'id, municipality_id, name' as const;

export const DEPARTMENT_COLUMNS = 'id, municipality_id, name, email, phone' as const;

export const REPORT_CATEGORY_COLUMNS =
  'id, code, name, icon, default_visibility, sort_order' as const;

export const MUNICIPALITY_REPORT_CATEGORY_COLUMNS =
  'municipality_id, category_id, default_priority' as const;

export const MUNICIPALITY_REPORT_CATEGORY_SELECT =
  `${MUNICIPALITY_REPORT_CATEGORY_COLUMNS}, category:report_categories!inner(${REPORT_CATEGORY_COLUMNS})` as const;

/** Must never include created_by / published_by, which no API role can read. */
export const ANNOUNCEMENT_COLUMNS =
  'id, municipality_id, department_id, neighborhood_id, title, body, severity, image_path, expires_at, published_at, created_at, updated_at' as const;
