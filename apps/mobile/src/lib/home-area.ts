import {
  listCities,
  listNeighborhoods,
  type Municipality,
  type Neighborhood,
} from '@smart-city/api';

import { useAsync } from '@/hooks/use-async';

import { getSupabase } from './supabase';

export { localizedName, municipalityOptions } from './city-options';

/**
 * Every city a citizen can live in (joined or not yet joined), via @smart-city/api.
 * For the home city at sign-up and in the profile, and for showing a municipality's name.
 */
export function useCities(enabled = true) {
  return useAsync<Municipality[]>(enabled ? 'cities' : null, () => listCities(getSupabase()));
}

/** Active neighborhoods of one municipality, via @smart-city/api. */
export function useNeighborhoods(municipalityId: string | null | undefined) {
  return useAsync<Neighborhood[]>(municipalityId ?? null, () =>
    listNeighborhoods(getSupabase(), { municipalityId: municipalityId! }),
  );
}
