import Ionicons from '@expo/vector-icons/Ionicons';
import {
  acceptsReports,
  getMyProfile,
  getMyReports,
  getPublicReports,
  type MyProfile,
  type PublicReport,
} from '@smart-city/api';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { PublicReportRow } from '@/components/explore/public-report-row';
import { MAP_SUPPORTED, PublicReportsMap } from '@/components/explore/public-reports-map';
import { LoadError } from '@/components/load-state';
import { Notice } from '@/components/report/notice';
import { SignInRequired } from '@/components/sign-in-required';
import { Text } from '@/components/text';
import { Segmented } from '@/components/ui/segmented';
import { SkeletonCard } from '@/components/ui/skeleton';
import { useAsync } from '@/hooks/use-async';
import { useThemeColors } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { locateDevice } from '@/lib/device-location';
import {
  areaAround,
  areaChanged,
  areaToRegion,
  regionToArea,
  sortByDistance,
  type Area,
  type Point,
  type Region,
} from '@/lib/explore';
import { localizedName, useCities } from '@/lib/home-area';
import { useI18n } from '@/lib/i18n';
import type { MyReport } from '@/lib/my-reports';
import { getSupabase } from '@/lib/supabase';
import { layout, radius, shadow, spacing } from '@/theme/metrics';

type View_ = 'list' | 'map';

/** Reports around the user: 3 km at first; the map can search the area in view. */
const START_RADIUS_KM = 3;

/**
 * Explore: public reports of the home municipality around the user, as a list (nearest first)
 * or on a map. Uses the device location when allowed; otherwise the user's own latest report.
 * Shows only what `get_public_reports` publishes (no personal details).
 */
export default function ExploreScreen() {
  const { t, locale } = useI18n();
  const colors = useThemeColors();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [view, setView] = useState<View_>('list');
  const [device, setDevice] = useState<Point | null>(null);
  const [locationOff, setLocationOff] = useState(false);
  const [locating, setLocating] = useState(false);
  const [searchArea, setSearchArea] = useState<Area | null>(null);
  const [visibleArea, setVisibleArea] = useState<Area | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<Region | null>(null);

  const profile = useAsync<MyProfile | null>(userId, () => getMyProfile(getSupabase()));
  const cities = useCities(Boolean(userId));
  const mine = useAsync<MyReport[]>(userId, () => getMyReports(getSupabase()));

  // Use the location silently if already allowed; never prompt on opening the tab.
  useEffect(() => {
    let active = true;
    Location.getForegroundPermissionsAsync().then(
      async (permission) => {
        if (!active) return;
        if (!permission.granted) {
          setLocationOff(true);
          return;
        }
        const result = await locateDevice();
        if (!active) return;
        if (result.status === 'located') setDevice(result.location);
        else setLocationOff(true);
      },
      () => active && setLocationOff(true),
    );
    return () => {
      active = false;
    };
  }, []);

  async function nearMe() {
    setLocating(true);
    const result = await locateDevice();
    setLocating(false);
    if (result.status !== 'located') {
      setLocationOff(true);
      return;
    }
    setLocationOff(false);
    setDevice(result.location);
    setSearchArea(null);
    setFocus(areaToRegion(areaAround(result.location, START_RADIUS_KM)));
  }

  const homeId = profile.status === 'success' ? (profile.data?.home_municipality_id ?? null) : null;
  const city =
    homeId && cities.status === 'success'
      ? cities.data.find((item) => item.id === homeId)
      : undefined;
  const joined = city ? acceptsReports(city) : false;

  // Without the device location: around the citizen's latest own report.
  const fallback = useMemo<Point | null>(() => {
    if (mine.status !== 'success') return null;
    const latest = mine.data.find((report) => report.municipality_id === homeId);
    return latest ? { latitude: latest.latitude, longitude: latest.longitude } : null;
  }, [mine, homeId]);
  const center = device ?? (locationOff ? fallback : null);
  const area = searchArea ?? (center ? areaAround(center, START_RADIUS_KM) : null);
  const areaKey = area ? `${area.south},${area.west},${area.north},${area.east}` : null;

  const reports = useAsync<PublicReport[]>(
    joined && homeId && areaKey ? `${homeId}:${areaKey}` : null,
    () => getPublicReports(getSupabase(), { municipalityId: homeId!, ...area!, limit: 200 }),
  );
  const items = useMemo(
    () => (reports.status === 'success' ? sortByDistance(reports.data, device) : []),
    [reports, device],
  );
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const canSearchHere = Boolean(visibleArea && area && areaChanged(visibleArea, area));

  function onRegionChangeComplete(region: Region) {
    setVisibleArea(regionToArea(region));
  }

  const header = (
    <View style={styles.header}>
      <Text variant="title" accessibilityRole="header">
        {t('citizen.explore.title')}
      </Text>
      <Text muted>
        {city
          ? `${t('citizen.explore.subtitle')} · ${localizedName(city.name, locale)}`
          : t('citizen.explore.subtitle')}
      </Text>
      <View style={styles.controls}>
        {MAP_SUPPORTED ? (
          <View style={styles.flex}>
            <Segmented
              value={view}
              onChange={setView}
              accessibilityLabel={t('citizen.explore.viewLabel')}
              options={[
                { value: 'list', label: t('citizen.explore.list') },
                { value: 'map', label: t('citizen.explore.map') },
              ]}
            />
          </View>
        ) : (
          <View style={styles.flex} />
        )}
        <Pressable
          onPress={nearMe}
          disabled={locating}
          accessibilityRole="button"
          accessibilityLabel={t('citizen.explore.nearMe')}
          accessibilityState={{ busy: locating }}
          style={({ pressed }) => [
            styles.nearMe,
            { backgroundColor: colors.primarySoft, borderColor: colors.primary },
            (pressed || locating) && styles.pressed,
          ]}
        >
          <Ionicons name="navigate" size={16} color={colors.primary} />
          <Text variant="label" style={{ color: colors.primary }}>
            {t('citizen.explore.nearMe')}
          </Text>
        </Pressable>
      </View>
      {locationOff && center ? <Notice message={t('citizen.explore.locationDenied')} /> : null}
    </View>
  );

  function body() {
    if (!user) return <SignInRequired />;
    if (profile.status === 'loading' || (homeId && cities.status === 'loading')) {
      return <SkeletonCard lines={3} />;
    }
    if (profile.status === 'error')
      return <LoadError error={profile.error} onRetry={profile.reload} />;
    if (!homeId) {
      return (
        <View style={styles.gap}>
          <EmptyState
            icon="home-outline"
            title={t('notices.noHomeTitle')}
            description={t('citizen.explore.noArea')}
          />
          <Button
            title={t('notices.setHomeCity')}
            onPress={() => router.push('/account/details')}
          />
        </View>
      );
    }
    if (city && !joined) {
      return (
        <EmptyState
          icon="time-outline"
          title={t('notices.notJoinedTitle', { municipality: localizedName(city.name, locale) })}
          description={t('citizen.home.servicesNotJoined', {
            municipality: localizedName(city.name, locale),
          })}
        />
      );
    }
    if (!area) {
      if (!locationOff || mine.status === 'loading') return <SkeletonCard lines={3} />;
      return <EmptyState icon="navigate-outline" title={t('citizen.explore.noArea')} />;
    }
    return null;
  }

  const blocked = body();

  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: colors.background }]}>
      {blocked || view === 'list' ? (
        <FlatList
          data={blocked ? [] : items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={header}
          ListEmptyComponent={
            blocked ??
            (reports.status === 'loading' ? (
              <SkeletonCard lines={3} />
            ) : reports.status === 'error' ? (
              <LoadError error={reports.error} onRetry={reports.reload} />
            ) : (
              <EmptyState icon="map-outline" title={t('citizen.explore.empty')} />
            ))
          }
          ListFooterComponent={
            !blocked && reports.status === 'success' ? (
              <Text variant="caption" muted style={styles.footer}>
                {t('citizen.explore.count', { count: items.length })} ·{' '}
                {t('citizen.explore.privacy')}
              </Text>
            ) : undefined
          }
          refreshing={false}
          onRefresh={!blocked ? reports.refresh : undefined}
          renderItem={({ item, index }) => (
            <View
              style={[
                styles.listCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                index === 0 && styles.first,
                index === items.length - 1 && styles.lastCard,
              ]}
            >
              <PublicReportRow report={item} origin={device} last={index === items.length - 1} />
            </View>
          )}
        />
      ) : (
        <View style={styles.mapScreen}>
          <View style={styles.mapHeader}>{header}</View>
          <View
            style={[
              styles.mapFrame,
              { borderColor: colors.border, backgroundColor: colors.surfaceMuted },
            ]}
          >
            <PublicReportsMap
              initialRegion={areaToRegion(area!)}
              reports={items}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onRegionChangeComplete={onRegionChangeComplete}
              showsUserLocation={device !== null}
              focus={focus}
            />
            {canSearchHere ? (
              <View style={styles.searchHere} pointerEvents="box-none">
                <Pressable
                  onPress={() => {
                    setSearchArea(visibleArea);
                    setSelectedId(null);
                  }}
                  accessibilityRole="button"
                  style={[
                    styles.searchButton,
                    { backgroundColor: colors.surface, shadowColor: colors.shadow },
                  ]}
                >
                  <Ionicons name="search" size={16} color={colors.primary} />
                  <Text variant="label" style={{ color: colors.primary }}>
                    {t('citizen.explore.searchHere')}
                  </Text>
                </Pressable>
              </View>
            ) : null}
            {reports.status === 'loading' ? (
              <View style={[styles.badge, { backgroundColor: colors.surface }]}>
                <Text variant="caption">{t('common.loading')}</Text>
              </View>
            ) : null}
            {selected ? (
              <View
                style={[
                  styles.sheet,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    shadowColor: colors.shadow,
                  },
                ]}
              >
                <View style={styles.flex}>
                  <PublicReportRow report={selected} origin={device} last />
                </View>
                <Pressable
                  onPress={() => setSelectedId(null)}
                  accessibilityRole="button"
                  accessibilityLabel={t('citizen.explore.close')}
                  hitSlop={10}
                >
                  <Ionicons name="close" size={22} color={colors.textMuted} />
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: {
    width: '100%',
    maxWidth: layout.maxWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.gutterWide,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  header: { gap: spacing.sm, marginBottom: spacing.lg },
  controls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  flex: { flex: 1 },
  nearMe: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  pressed: { opacity: 0.7 },
  gap: { gap: spacing.md },
  listCard: {
    paddingHorizontal: spacing.lg,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  first: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  lastCard: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  footer: { textAlign: 'center', marginTop: spacing.lg },
  mapScreen: { flex: 1 },
  mapHeader: { paddingHorizontal: layout.gutterWide, paddingTop: spacing.xl },
  mapFrame: {
    flex: 1,
    marginHorizontal: layout.gutter,
    marginBottom: spacing.md,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  searchHere: { position: 'absolute', top: spacing.md, start: 0, end: 0, alignItems: 'center' },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    ...shadow.raised,
  },
  badge: {
    position: 'absolute',
    top: spacing.md,
    end: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  sheet: {
    position: 'absolute',
    start: spacing.md,
    end: spacing.md,
    bottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    ...shadow.raised,
  },
});
