import Ionicons from '@expo/vector-icons/Ionicons';
import { getMyReports, getMyReportUpdates } from '@smart-city/api';
import { radii, spacing } from '@smart-city/shared';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { LoadError, LoadingState } from '@/components/load-state';
import { CATEGORY_ICONS } from '@/components/report/category-icons';
import { Notice } from '@/components/report/notice';
import { StatusBadge } from '@/components/report/status-badge';
import { screenHeaderOptions } from '@/components/screen-header';
import { SignInRequired } from '@/components/sign-in-required';
import { Text } from '@/components/text';
import { useAsync } from '@/hooks/use-async';
import { useThemeColors } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import {
  formatReportDate,
  toReportCategory,
  type MyReport,
  type MyReportUpdate,
} from '@/lib/my-reports';
import { getSupabase } from '@/lib/supabase';

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
 * One of the citizen's reports with its status timeline (`get_my_report_updates`, public notes
 * only; it includes the initial "submitted" entry written at submission).
 */
export default function ReportDetailsScreen() {
  const { t, locale } = useI18n();
  const colors = useThemeColors();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const details = useAsync<ReportDetails>(user && id ? `${user.id}:${id}` : null, () =>
    loadReportDetails(id),
  );
  const header = (
    <Stack.Screen options={screenHeaderOptions(colors, t('myReports.detailsTitle'))} />
  );

  if (!user || details.status !== 'success' || !details.data.report) {
    return (
      <View style={styles.content}>
        {header}
        {!user ? (
          <SignInRequired />
        ) : details.status === 'loading' ? (
          <LoadingState />
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

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {header}

      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name={CATEGORY_ICONS[category]} size={28} color={colors.primary} />
        </View>
        <View style={styles.flex}>
          <Text variant="heading">{t(`reportCategory.${category}`)}</Text>
          <Text muted style={styles.ltr} selectable>
            {report.tracking_number}
          </Text>
          <Text variant="caption" muted>
            {t('myReports.submittedOn', { date: formatReportDate(report.created_at, locale) })}
          </Text>
        </View>
        <StatusBadge status={report.status} />
      </View>

      {report.rejection_reason ? (
        <Notice tone="error" message={t(`reportRejectionReason.${report.rejection_reason}`)} />
      ) : null}

      <View style={[styles.section, { borderColor: colors.border }]}>
        <Text variant="caption" muted>
          {t('myReports.description')}
        </Text>
        <Text>{report.description}</Text>
      </View>

      {report.address ? (
        <View style={[styles.section, { borderColor: colors.border }]}>
          <Text variant="caption" muted>
            {t('myReports.location')}
          </Text>
          <View style={styles.inline}>
            <Ionicons name="location-outline" size={18} color={colors.primary} />
            <Text>{report.address}</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.timeline}>
        <Text variant="caption" muted accessibilityRole="header">
          {t('myReports.timeline')}
        </Text>
        {timeline.map((entry, index) => {
          const isLast = index === timeline.length - 1;
          return (
            <View key={`${entry.to_status}-${entry.created_at}`} style={styles.entry}>
              <View style={styles.rail}>
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor: isLast ? colors.primary : colors.surface,
                      borderColor: colors.primary,
                    },
                  ]}
                />
                {!isLast ? (
                  <View style={[styles.line, { backgroundColor: colors.border }]} />
                ) : null}
              </View>
              <View style={[styles.flex, styles.entryText]}>
                <Text style={styles.status}>{t(`reportStatus.${entry.to_status}`)}</Text>
                <Text variant="caption" muted>
                  {formatReportDate(entry.created_at, locale)}
                </Text>
                {entry.note ? <Text>{entry.note}</Text> : null}
              </View>
            </View>
          );
        })}
        {timeline.length === 0 ? (
          <Text variant="caption" muted>
            {t('myReports.noUpdates')}
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  icon: {
    width: 52,
    height: 52,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  ltr: { writingDirection: 'ltr', alignSelf: 'flex-start' },
  section: { gap: spacing.xs, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  timeline: { gap: spacing.sm },
  entry: { flexDirection: 'row', gap: spacing.md },
  rail: { alignItems: 'center', width: 16 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, marginTop: 4 },
  line: { flex: 1, width: 2, marginVertical: 2 },
  entryText: { gap: 2, paddingBottom: spacing.md },
  status: { fontWeight: '600' },
});
