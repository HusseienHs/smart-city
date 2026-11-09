import Ionicons from '@expo/vector-icons/Ionicons';
import { getMyReports } from '@smart-city/api';
import { elevation, radii, spacing } from '@smart-city/shared';
import { router, Stack } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { LoadError, LoadingState } from '@/components/load-state';
import { CATEGORY_ICONS } from '@/components/report/category-icons';
import { StatusBadge } from '@/components/report/status-badge';
import { screenHeaderOptions } from '@/components/screen-header';
import { SignInRequired } from '@/components/sign-in-required';
import { Text } from '@/components/text';
import { useAsync } from '@/hooks/use-async';
import { useThemeColors } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { formatReportDate, toReportCategory, type MyReport } from '@/lib/my-reports';
import { getSupabase } from '@/lib/supabase';

/** The citizen's own reports (`getMyReports`, own reports only, newest first). */
export default function MyReportsScreen() {
  const { t, locale, direction } = useI18n();
  const colors = useThemeColors();
  const { user } = useAuth();
  const reports = useAsync<MyReport[]>(user?.id ?? null, () => getMyReports(getSupabase()));
  const header = <Stack.Screen options={screenHeaderOptions(colors, t('myReports.title'))} />;

  if (!user) {
    return (
      <View style={styles.content}>
        {header}
        <SignInRequired />
      </View>
    );
  }
  if (reports.status !== 'success') {
    return (
      <View style={styles.content}>
        {header}
        {reports.status === 'loading' ? (
          <LoadingState />
        ) : (
          <LoadError error={reports.error} onRetry={reports.reload} />
        )}
      </View>
    );
  }

  const items = reports.data;
  return (
    <>
      {header}
      <FlatList
        data={items}
        keyExtractor={(report) => report.id}
        contentContainerStyle={styles.content}
        refreshing={false}
        onRefresh={reports.refresh}
        ListEmptyComponent={
          <EmptyState icon="document-text-outline" title={t('myReports.empty')} />
        }
        renderItem={({ item }) => {
          const category = toReportCategory(item.category_code);
          const label = t(`reportCategory.${category}`);
          return (
            <Pressable
              onPress={() => router.push({ pathname: '/my-reports/[id]', params: { id: item.id } })}
              accessibilityRole="button"
              accessibilityLabel={`${label}, ${item.tracking_number}, ${t(`reportStatus.${item.status}`)}`}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  shadowColor: colors.shadow,
                },
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name={CATEGORY_ICONS[category]} size={22} color={colors.primary} />
              </View>
              <View style={styles.text}>
                <Text style={styles.title} numberOfLines={1}>
                  {label}
                </Text>
                <Text variant="caption" muted style={styles.ltr}>
                  {item.tracking_number}
                </Text>
                <Text variant="caption" muted>
                  {t('myReports.submittedOn', { date: formatReportDate(item.created_at, locale) })}
                </Text>
                <View style={styles.badge}>
                  <StatusBadge status={item.status} />
                </View>
              </View>
              <Ionicons
                name={direction === 'rtl' ? 'chevron-back' : 'chevron-forward'}
                size={18}
                color={colors.textMuted}
              />
            </Pressable>
          );
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, gap: spacing.md, paddingBottom: spacing.xxxl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    ...elevation.sm,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 17, fontWeight: '600' },
  badge: { marginTop: spacing.xs },
  // Tracking numbers are Latin/digits: keep them left-to-right in Hebrew and Arabic.
  ltr: { writingDirection: 'ltr', alignSelf: 'flex-start' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
});
