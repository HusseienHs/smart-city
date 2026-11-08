/*
 * Explicit column lists for the signed-in user's own rows. Exported so the database tests can
 * run them against the real grants and policies (supabase/tests/api-column-access.test.ts).
 */

export const MY_PROFILE_COLUMNS =
  'id, full_name, preferred_locale, home_municipality_id, home_neighborhood_id' as const;

export const MY_PHONE_COLUMNS = 'phone' as const;
