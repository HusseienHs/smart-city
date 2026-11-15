import Ionicons from '@expo/vector-icons/Ionicons';
import { getMyReports } from '@smart-city/api';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { LoadError } from '@/components/load-state';
import { CATEGORY_ICONS } from '@/components/report/category-icons';
import { StatusBadge } from '@/components/report/status-badge';
import { useScreenHeaderOptions } from '@/components/screen-header';
import { SignInRequired } from '@/components/sign-in-required';
import { Text } from '@/components/text';
import { ChipGroup } from '@/components/ui/chip-group';
import { forwardChevron } from '@/components/ui/icon';
import { IconBadge } from '@/components/ui/icon-badge';
import { PressableCard } from '@/components/ui/pressable-card';
import { SkeletonCard } from '@/components/ui/skeleton';
import { useAsync } from '@/hooks/use-async';
import { useThemeColors } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import {
  countMyReportFilters,
  filterMyReports,
  formatReportDate,
  MY_REPORT_FILTERS,
  toReportCategory,
  type MyReport,
  type MyReportFilter,
} from '@/lib/my-reports';
import { getSupabase } from '@/lib/supabase';
import { layout, radius, shadow, spacing } from '@/theme/metrics';

/** The citizen's own reports (`getMyReports`, own reports only, newest first), filterable. */
export default function MyReportsScreen() {
  const { t, locale, direction } = useI18n();
  const colors = useThemeColors();
  const headerOptions = useScreenHeaderOptions(t('myReports.title'));
  const { user } = useAuth();
  const reports = useAsync<MyReport[]>(user?.id ?? null, () => getMyReports(getSupabase()));
  const [filter, setFilter] = useState<MyReportFilter>('all');
  const header = <Stack.Screen options={headerOptions} />;

  const all = reports.status === 'success' ? reports.data : null;
  const counts = useMemo(() => (all ? countMyReportFilters(all) : null), [all]);
  const items = useMemo(() => (all ? filterMyReports(all, filter) : []), [all, filter]);

  if (!user || reports.status !== 'success') {
    return (
      <View style={styles.content}>
        {header}
        {!user ? (
          <SignInRequired />
        ) : reports.status !== 'error' ? (
          <View style={styles.gap}>
            <SkeletonCard lines={2} />
            <SkeletonCard lines={2} />
          </View>
        ) : (
          <LoadError error={reports.error} onRetry={reports.reload} />
        )}
      </View>
    );
  }

  return (
    <>
      {header}
      <FlatList
        data={items}
        keyExtractor={(report) => report.id}
        contentContainerStyle={styles.content}
        refreshing={false}
        onRefresh={reports.refresh}
        ListHeaderComponent={
          counts && counts.all > 0 ? (
            <ChipGroup
              value={filter}
              onChange={setFilter}
              accessibilityLabel={t('citizen.myReports.filterLabel')}
              options={MY_REPORT_FILTERS.map((value) => ({
                value,
                label: t(`citizen.myReports.${value}`),
                count: counts[value],
              }))}
            />
          ) : undefined
        }
        ListEmptyComponent={
          counts && counts.all > 0 ? (
            <EmptyState icon="filter-outline" title={t('citizen.myReports.emptyFilter')} />
          ) : (
            <EmptyState
              icon="document-text-outline"
              title={t('myReports.empty')}
              description={t('citizen.home.summaryEmpty')}
            />
          )
        }
        renderItem={({ item }) => {
          const category = toReportCategory(item.category_code);
          const label = t(`reportCategory.${category}`);
          const sent = t('citizen.myReports.sentOn', {
            date: formatReportDate(item.created_at, locale),
          });
          return (
            <PressableCard
              onPress={() => router.push({ pathname: '/my-reports/[id]', params: { id: item.id } })}
              accessibilityLabel={`${label}, ${item.tracking_number}, ${t(`reportStatus.${item.status}`)}, ${sent}`}
              style={[
                styles.row,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  shadowColor: colors.shadow,
                },
              ]}
            >
              <IconBadge icon={CATEGORY_ICONS[category]} size="lg" />
              <View style={styles.text}>
                <View style={styles.top}>
                  <Text variant="subheading" numberOfLines={1} style={styles.flex}>
                    {label}
                  </Text>
                  <Ionicons
                    name={forwardChevron(direction === 'rtl')}
                    size={18}
                    color={colors.textMuted}
                  />
                </View>
                <Text variant="caption" style={[styles.ltr, { color: colors.primary }]}>
                  {item.tracking_number}
                </Text>
                {item.address ? (
                  <Text variant="caption" muted numberOfLines={1}>
                    {item.address}
                  </Text>
                ) : null}
                <View style={styles.bottom}>
                  <StatusBadge status={item.status} />
                  <Text variant="micro" muted>
                    {sent}
                  </Text>
                </View>
              </View>
            </PressableCard>
          );
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: layout.maxWidth,
    alignSelf: 'center',
    padding: layout.gutterWide,
    gap: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  gap: { gap: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    ...shadow.card,
  },
  text: { flex: 1, gap: 3 },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  bottom: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  // Tracking numbers are Latin/digits: keep them left-to-right in Hebrew and Arabic.
  ltr: { writingDirection: 'ltr', alignSelf: 'flex-start', fontWeight: '700' },
});
