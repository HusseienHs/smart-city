import {
  listMunicipalities,
  listNeighborhoods,
  type Municipality,
  type Neighborhood,
} from '@smart-city/api';
import type { Locale, LocalizedText } from '@smart-city/shared';

import { useAsync } from '@/hooks/use-async';

import { getSupabase } from './supabase';

/** Localized name with the documented fallback: the locale, then Hebrew (always present). */
export function localizedName(name: LocalizedText, locale: Locale): string {
  return name[locale] || name.he;
}

/** Active municipalities, via @smart-city/api (readable by any user, RLS-protected). */
export function useMunicipalities(enabled = true) {
  return useAsync<Municipality[]>(enabled ? 'municipalities' : null, () =>
    listMunicipalities(getSupabase()),
  );
}

/** Active neighborhoods of one municipality, via @smart-city/api. */
export function useNeighborhoods(municipalityId: string | null | undefined) {
  return useAsync<Neighborhood[]>(municipalityId ?? null, () =>
    listNeighborhoods(getSupabase(), { municipalityId: municipalityId! }),
  );
}
