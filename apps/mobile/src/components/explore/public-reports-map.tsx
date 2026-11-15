import Ionicons from '@expo/vector-icons/Ionicons';
import type { PublicReport } from '@smart-city/api';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import { CATEGORY_ICONS } from '@/components/report/category-icons';
import { useThemeColors } from '@/hooks/use-theme';
import { env } from '@/lib/env';
import type { Region } from '@/lib/explore';
import { useI18n } from '@/lib/i18n';
import { toReportCategory } from '@/lib/my-reports';
import { radius, shadow } from '@/theme/metrics';

/** react-native-maps has no web build; the web variant of this file reports false. */
export const MAP_SUPPORTED = true;

interface PublicReportsMapProps {
  initialRegion: Region;
  reports: readonly PublicReport[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onRegionChangeComplete: (region: Region) => void;
  showsUserLocation: boolean;
  /** When this region changes (e.g. "Near me"), the map glides to it. */
  focus: Region | null;
}

/**
 * Interactive map of public reports (react-native-maps: Apple Maps on iOS, Google Maps on
 * Android; Google on both when EXPO_PUBLIC_MAP_PROVIDER=google). Markers sit on the ~50 m grid
 * location the database publishes, never the exact spot.
 */
export function PublicReportsMap({
  initialRegion,
  reports,
  selectedId,
  onSelect,
  onRegionChangeComplete,
  showsUserLocation,
  focus,
}: PublicReportsMapProps) {
  const { t } = useI18n();
  const colors = useThemeColors();
  const map = useRef<MapView>(null);

  useEffect(() => {
    if (focus) map.current?.animateToRegion(focus, 400);
  }, [focus]);

  return (
    <MapView
      ref={map}
      style={StyleSheet.absoluteFill}
      provider={env.mapProvider === 'google' ? PROVIDER_GOOGLE : undefined}
      initialRegion={initialRegion}
      onRegionChangeComplete={onRegionChangeComplete}
      onPress={() => onSelect(null)}
      showsUserLocation={showsUserLocation}
      showsMyLocationButton={false}
      toolbarEnabled={false}
      rotateEnabled={false}
      pitchEnabled={false}
      accessibilityLabel={t('citizen.explore.mapA11y')}
    >
      {reports.map((report) => {
        const selected = report.id === selectedId;
        const category = toReportCategory(report.category_code);
        return (
          <Marker
            key={report.id}
            coordinate={{ latitude: report.latitude, longitude: report.longitude }}
            onPress={(event) => {
              event.stopPropagation();
              onSelect(report.id);
            }}
            accessibilityLabel={t(`reportCategory.${category}`)}
            tracksViewChanges={false}
          >
            <View
              style={[
                styles.pin,
                {
                  backgroundColor: selected ? colors.primary : colors.surface,
                  borderColor: colors.primary,
                  shadowColor: colors.shadow,
                },
                selected && styles.selected,
              ]}
            >
              <Ionicons
                name={CATEGORY_ICONS[category]}
                size={16}
                color={selected ? colors.onPrimary : colors.primary}
              />
            </View>
          </Marker>
        );
      })}
    </MapView>
  );
}

const styles = StyleSheet.create({
  pin: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
    shadowOpacity: 0.2,
  },
  selected: { transform: [{ scale: 1.15 }] },
});
