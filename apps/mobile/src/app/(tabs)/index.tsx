import {
  acceptsReports,
  getMyProfile,
  getMyReportPhotos,
  getMyReports,
  getMyReportUpdates,
  type MyProfile,
} from '@smart-city/api';
import type { ReportCategory } from '@smart-city/shared';
import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { HeroBanner } from '@/components/home/hero-banner';
import { MapPreviewCard } from '@/components/home/map-preview-card';
import { ReportSummaryCard } from '@/components/home/report-summary';
import { ReportTracker } from '@/components/home/report-tracker';
import { ServiceGrid } from '@/components/home/service-grid';
import { LoadError } from '@/components/load-state';
import { AnnouncementRow } from '@/components/notices/announcement-row';
import { Notice } from '@/components/report/notice';
import { SignInRequired } from '@/components/sign-in-required';
import { Text } from '@/components/text';
import { FadeIn } from '@/components/ui/fade-in';
import { SectionHeader } from '@/components/ui/section-header';
import { SkeletonCard } from '@/components/ui/skeleton';
import { useAsync } from '@/hooks/use-async';
import { useAuth } from '@/lib/auth';
import { localizedName, useCities } from '@/lib/home-area';
import {
  dayPart,
  firstName,
  pickTrackedReport,
  quickServices,
  summarizeMyReports,
  trackedRequestKeys,
  trackerSteps,
} from '@/lib/home-dashboard';
import { useI18n } from '@/lib/i18n';
import { toReportCategory, type MyReport } from '@/lib/my-reports';
import { isDraftStarted } from '@/lib/report-draft';
import { useReportDraft } from '@/lib/report-draft-context';
import { useReportCategories } from '@/lib/report-options';
import { getSupabase } from '@/lib/supabase';
import { useAppTheme } from '@/lib/theme';
import { useUpdates } from '@/lib/updates-context';
import { layout, spacing } from '@/theme/metrics';

/**
 * Home: a personal city dashboard. Every section uses the citizen's real data (profile, own
 * reports, the municipality's categories and announcements) and loads on its own, with its own
 * placeholder and error state.
 */
export default function HomeScreen() {
  const { t, locale } = useI18n();
  const { scheme } = useAppTheme();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { draft, dispatch } = useReportDraft();
  const { board, hasUnseen } = useUpdates();

  const profile = useAsync<MyProfile | null>(userId, () => getMyProfile(getSupabase()));
  const reports = useAsync<MyReport[]>(userId, () => getMyReports(getSupabase()));
  const cities = useCities(Boolean(userId));

  // Light status bar text over the hero photo; back to the theme's when leaving Home. Data is
  // refreshed quietly when Home comes back into view (e.g. after sending a report).
  const { refresh: refreshProfile } = profile;
  const { refresh: refreshReports } = reports;
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      if (userId) {
        refreshProfile();
        refreshReports();
      }
      return () => setStatusBarStyle(scheme === 'dark' ? 'light' : 'dark');
    }, [scheme, userId, refreshProfile, refreshReports]),
  );

  const me = profile.status === 'success' ? profile.data : null;
  const homeId = me?.home_municipality_id ?? null;
  const city =
    homeId && cities.status === 'success'
      ? cities.data.find((item) => item.id === homeId)
      : undefined;
  const cityName = city ? localizedName(city.name, locale) : null;
  const joined = city ? acceptsReports(city) : false;
  const categories = useReportCategories(joined && homeId ? homeId : null);

  const myReports = reports.status === 'success' ? reports.data : null;
  const summary = useMemo(() => (myReports ? summarizeMyReports(myReports) : null), [myReports]);
  const tracked = useMemo(() => (myReports ? pickTrackedReport(myReports) : null), [myReports]);
  // Only primitives here: React Compiler memoizes these loaders on what they read, and it reads
  // those values on every render (including when there is no tracked report). A property read
  // on a nullable object (`tracked!.id`) therefore crashed Home whenever `tracked` was null.
  const keys = trackedRequestKeys(tracked);
  const trackedId = keys.reportId;
  const updates = useAsync(keys.updates, () =>
    trackedId ? getMyReportUpdates(getSupabase(), { reportId: trackedId }) : Promise.resolve([]),
  );
  const trackedPhotos = useAsync(keys.photos, () =>
    trackedId ? getMyReportPhotos(getSupabase(), { reportId: trackedId }) : Promise.resolve([]),
  );
  const trackedPhoto =
    trackedPhotos.status === 'success'
      ? (trackedPhotos.data.find((photo) => photo.kind === 'citizen_photo' && photo.url)?.url ??
        null)
      : null;
  const steps =
    tracked && updates.status === 'success'
      ? trackerSteps(tracked, updates.data)
      : tracked
        ? trackerSteps(tracked, [])
        : null;

  const metadataName: unknown = user?.user_metadata.full_name;
  const name = firstName(me?.full_name ?? (typeof metadataName === 'string' ? metadataName : ''));
  const part = dayPart(new Date());
  const greeting = name
    ? t(`citizen.home.greeting${part}`, { name })
    : t(`citizen.home.greeting${part}NoName`);

  function startReport(category?: ReportCategory) {
    // A report in progress (or one still sending photos) is never replaced by a shortcut.
    if (!category || draft.submission || (isDraftStarted(draft) && draft.category !== category)) {
      router.push('/report');
      return;
    }
    dispatch({ type: 'setCategory', category });
    router.push('/new-report/category');
  }

  const news =
    board.status === 'success' && board.data.kind === 'ready'
      ? board.data.announcements.slice(0, 2)
      : null;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.scroll}
      contentInsetAdjustmentBehavior="never"
    >
      <HeroBanner
        greeting={greeting}
        municipalityLabel={cityName ? t('citizen.home.municipalityOf', { city: cityName }) : null}
        cityLabel={cityName ?? t('citizen.home.chooseCity')}
        cityAccessibilityLabel={
          cityName
            ? t('citizen.home.cityChipLabel', { city: cityName })
            : t('citizen.home.chooseCity')
        }
        onCityPress={() => router.push('/account/details')}
        hasUnseenUpdates={hasUnseen}
        onUpdatesPress={() => router.push('/notices')}
        onReportPress={() => startReport()}
      />

      <View style={styles.column}>
        {!user ? (
          <SignInRequired />
        ) : (
          <>
            <FadeIn index={0}>
              {reports.status === 'loading' ? (
                <SkeletonCard lines={2} />
              ) : reports.status === 'error' ? (
                <LoadError error={reports.error} onRetry={reports.reload} />
              ) : summary ? (
                <ReportSummaryCard summary={summary} onViewAll={() => router.push('/my-reports')} />
              ) : null}
            </FadeIn>

            <FadeIn index={1} style={styles.section}>
              <SectionHeader title={t('citizen.home.servicesTitle')} icon="grid-outline" />
              {profile.status === 'loading' || (homeId && cities.status === 'loading') ? (
                <SkeletonCard lines={2} />
              ) : !homeId ? (
                <Notice message={t('citizen.home.servicesNoHome')} icon="home-outline" />
              ) : city && !joined ? (
                <Notice
                  message={t('citizen.home.servicesNotJoined', { municipality: cityName ?? '' })}
                  icon="time-outline"
                />
              ) : categories.status === 'loading' ? (
                <SkeletonCard lines={2} />
              ) : categories.status === 'error' ? (
                <LoadError error={categories.error} onRetry={categories.reload} />
              ) : (
                <ServiceGrid categories={quickServices(categories.data)} onSelect={startReport} />
              )}
            </FadeIn>

            {tracked && steps ? (
              <FadeIn index={2}>
                <ReportTracker
                  trackingNumber={tracked.tracking_number}
                  category={toReportCategory(tracked.category_code)}
                  address={tracked.address}
                  steps={steps}
                  photoUri={trackedPhoto}
                  onPress={() => {
                    if (trackedId) {
                      router.push({ pathname: '/my-reports/[id]', params: { id: trackedId } });
                    }
                  }}
                />
              </FadeIn>
            ) : null}

            <FadeIn index={3}>
              <MapPreviewCard onPress={() => router.push('/explore')} />
            </FadeIn>

            <FadeIn index={4}>
              <Card>
                <SectionHeader
                  title={t('citizen.home.newsTitle')}
                  icon="megaphone-outline"
                  action={{
                    label: t('citizen.home.viewAll'),
                    onPress: () => router.push('/notices'),
                  }}
                />
                {board.status === 'loading' ? (
                  <SkeletonCard lines={2} />
                ) : board.status === 'error' ? (
                  <LoadError error={board.error} onRetry={board.reload} />
                ) : news && news.length > 0 ? (
                  <View>
                    {news.map((item, index) => (
                      <AnnouncementRow
                        key={item.id}
                        announcement={item}
                        last={index === news.length - 1}
                        onPress={() =>
                          router.push({ pathname: '/notices/[id]', params: { id: item.id } })
                        }
                      />
                    ))}
                  </View>
                ) : (
                  <Text muted>{t('citizen.home.newsEmpty')}</Text>
                )}
              </Card>
            </FadeIn>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingBottom: spacing.xxxl },
  column: {
    width: '100%',
    maxWidth: layout.maxWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  section: { gap: spacing.md },
});
