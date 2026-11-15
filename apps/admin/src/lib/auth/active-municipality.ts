/**
 * The municipality a staff member is working in, for staff with more than one membership.
 *
 * The cookie only records a PREFERENCE. It is never trusted: on every request it is matched
 * against the caller's active memberships, which come from the database for the verified
 * user. An unknown, foreign or revoked municipality id simply falls back to the first
 * membership. Even a forged value cannot grant access — RLS checks membership on every query.
 */
export const ACTIVE_MUNICIPALITY_COOKIE = 'sc_admin_municipality';
export const ACTIVE_MUNICIPALITY_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

export function resolveActiveMembership<M extends { municipality_id: string }>(
  memberships: readonly M[],
  requestedMunicipalityId: string | null | undefined,
): M | null {
  if (requestedMunicipalityId) {
    const requested = memberships.find((m) => m.municipality_id === requestedMunicipalityId);
    if (requested) return requested;
  }
  return memberships[0] ?? null;
}
