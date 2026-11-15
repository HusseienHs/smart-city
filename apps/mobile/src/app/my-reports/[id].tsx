import Ionicons from '@expo/vector-icons/Ionicons';
import {
  getMyReportPhotos,
  getMyReports,
  getMyReportUpdates,
  type MyReportPhoto,
} from '@smart-city/api';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { LoadError } from '@/components/load-state';
import { CATEGORY_ICONS } from '@/components/report/category-icons';
import { Notice } from '@/components/report/notice';
import { StatusBadge, useStatusColors } from '@/components/report/status-badge';
import { StatusStepper } from '@/components/report/status-stepper';
import { useScreenHeaderOptions } from '@/components/screen-header';
import { SignInRequired } from '@/components/sign-in-required';
import { Text } from '@/components/text';
import { IconBadge } from '@/components/ui/icon-badge';
import { SkeletonCard } from '@/components/ui/skeleton';
import { useAsync } from '@/hooks/use-async';
import { useThemeColors } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { trackerSteps } from '@/lib/home-dashboard';
import { useI18n } from '@/lib/i18n';
import {
  formatReportDate,
  toReportCategory,
  type MyReport,
  type MyReportUpdate,
} from '@/lib/my-reports';
import { getSupabase } from '@/lib/supabase';
import { layout, radius, spacing } from '@/theme/metrics';

interface ReportDetails {
  report: MyReport | null;
  updates: MyReportUpdate[];
}

/** Both come from own-report RPCs: someone else's report id yields "not found". */
async function loadReportDetails(reportId: string): Promise<ReportDetails> {
  const client = getSupabase();
  const [reports, updates] = await Promise.all([
    getMyReports(client),
    getMyReportUpdates(client, { reportId }),
  ]);
  return { report: reports.find((item) => item.id === reportId) ?? null, updates };
}

/**
 * One of the citizen's reports: progress, own photos (short-lived signed URLs, never stored),
 * description, location and the status timeline (`get_my_report_updates`, public notes only).
 */
export default function ReportDetailsScreen() {
  const { t, locale } = useI18n();
  const colors = useThemeColors();
  const headerOptions = useScreenHeaderOptions(t('myReports.detailsTitle'));
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const key = user && id ? `${user.id}:${id}` : null;
  const details = useAsync<ReportDetails>(key, () => loadReportDetails(id));
  const photos = useAsync<MyReportPhoto[]>(key, () =>
    getMyReportPhotos(getSupabase(), { reportId: id }),
  );
  const header = <Stack.Screen options={headerOptions} />;

  if (!user || details.status !== 'success' || !details.data.report) {
    return (
      <View style={styles.content}>
        {header}
        {!user ? (
          <SignInRequired />
        ) : details.status === 'loading' ? (
          <View style={styles.gap}>
            <SkeletonCard lines={3} />
            <SkeletonCard lines={2} />
          </View>
        ) : details.status === 'error' ? (
          <LoadError error={details.error} onRetry={details.reload} />
        ) : (
          <EmptyState icon="alert-circle-outline" title={t('myReports.notFound')} />
        )}
      </View>
    );
  }

  const { report, updates: timeline } = details.data;
  const category = toReportCategory(report.category_code);
  const steps = trackerSteps(report, timeline);
  const shown =
    photos.status === 'success' ? photos.data.filter((photo) => photo.url !== null) : [];

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {header}

      <Card elevation="raised">
        <View style={styles.header}>
          <IconBadge icon={CATEGORY_ICONS[category]} size="lg" shape="circle" />
          <View style={styles.flex}>
            <Text variant="heading">{t(`reportCategory.${category}`)}</Text>
            <Text style={[styles.ltr, { color: colors.primary }]} selectable>
              {report.tracking_number}
            </Text>
            <Text variant="caption" muted>
              {t('myReports.submittedOn', { date: formatReportDate(report.created_at, locale) })}
            </Text>
          </View>
          <StatusBadge status={report.status} />
        </View>
        {steps ? <StatusStepper steps={steps} /> : null}
      </Card>

      {report.rejection_reason ? (
        <Notice tone="error" message={t(`reportRejectionReason.${report.rejection_reason}`)} />
      ) : null}

      {shown.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.photos}
        >
          {shown.map((photo) => (
            <Image
              key={photo.attachmentId}
              source={{ uri: photo.url! }}
              // Signed URLs expire within minutes: keep them in memory only.
              cachePolicy="memory"
              contentFit="cover"
              transition={150}
              style={[styles.photo, { backgroundColor: colors.surfaceMuted }]}
              accessibilityLabel={t(`reportCategory.${category}`)}
            />
          ))}
        </ScrollView>
      ) : null}

      <Card>
        <Text variant="overline" muted accessibilityRole="header">
          {t('myReports.description')}
        </Text>
        <Text>{report.description}</Text>
      </Card>

      {report.address ? (
        <Card>
          <Text variant="overline" muted accessibilityRole="header">
            {t('myReports.location')}
          </Text>
          <View style={styles.inline}>
            <Ionicons name="location" size={18} color={colors.primary} />
            <Text style={styles.flex}>{report.address}</Text>
          </View>
        </Card>
      ) : null}

      <Card>
        <Text variant="overline" muted accessibilityRole="header">
          {t('myReports.timeline')}
        </Text>
        {timeline.map((entry, index) => (
          <TimelineEntry
            key={`${entry.to_status}-${entry.created_at}`}
            entry={entry}
            latest={index === timeline.length - 1}
          />
        ))}
        {timeline.length === 0 ? (
          <Text variant="caption" muted>
            {t('myReports.noUpdates')}
          </Text>
        ) : null}
      </Card>
    </ScrollView>
  );
}

function TimelineEntry({ entry, latest }: { entry: MyReportUpdate; latest: boolean }) {
  const { t, locale } = useI18n();
  const colors = useThemeColors();
  const { color, background } = useStatusColors(entry.to_status);
  return (
    <View style={styles.entry}>
      <View style={styles.rail}>
        <View
          style={[styles.dot, { backgroundColor: latest ? color : background, borderColor: color }]}
        />
        {!latest ? <View style={[styles.line, { backgroundColor: colors.border }]} /> : null}
      </View>
      <View style={[styles.flex, styles.entryText]}>
        <Text variant="label">{t(`reportStatus.${entry.to_status}`)}</Text>
        <Text variant="caption" muted>
          {formatReportDate(entry.created_at, locale)}
        </Text>
        {entry.note ? (
          <View style={[styles.note, { backgroundColor: colors.surfaceMuted }]}>
            <Text variant="caption">{entry.note}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: layout.maxWidth,
    alignSelf: 'center',
    padding: layout.gutterWide,
    gap: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  gap: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  flex: { flex: 1 },
  ltr: { writingDirection: 'ltr', alignSelf: 'flex-start', fontWeight: '700' },
  photos: { gap: spacing.sm },
  photo: { width: 180, height: 130, borderRadius: radius.md },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  entry: { flexDirection: 'row', gap: spacing.md },
  rail: { alignItems: 'center', width: 16 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, marginTop: 4 },
  line: { flex: 1, width: 2, marginVertical: 2 },
  entryText: { gap: 2, paddingBottom: spacing.md },
  note: { marginTop: spacing.xs, padding: spacing.sm, borderRadius: radius.sm },
});
