import type { PublicReport } from '@smart-city/api';

import type { Region } from '@/lib/explore';

/** react-native-maps has no web build: Explore shows the list only on the web. */
export const MAP_SUPPORTED = false;

interface PublicReportsMapProps {
  initialRegion: Region;
  reports: readonly PublicReport[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onRegionChangeComplete: (region: Region) => void;
  showsUserLocation: boolean;
  focus: Region | null;
}

export function PublicReportsMap(_props: PublicReportsMapProps) {
  return null;
}
