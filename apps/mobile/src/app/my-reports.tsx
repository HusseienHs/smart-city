import Ionicons from '@expo/vector-icons/Ionicons';
import { getMyReports } from '@smart-city/api';
import { spacing } from '@smart-city/shared';
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
  const { t, locale } = useI18n();
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
        renderItem={({ item, index }) => {
          const category = toReportCategory(item.category_code);
          const label = t(`reportCategory.${category}`);
          return (
            <Pressable
              onPress={() => router.push({ pathname: '/my-reports/[id]', params: { id: item.id } })}
              accessibilityRole="button"
              accessibilityLabel={`${label}, ${item.tracking_number}, ${t(`reportStatus.${item.status}`)}`}
              style={({ pressed }) => [
                styles.row,
                index < items.length - 1 && {
                  borderBottomColor: colors.border,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                },
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name={CATEGORY_ICONS[category]} size={24} color={colors.primary} />
              <View style={styles.text}>
                <Text style={styles.title}>{label}</Text>
                <Text variant="caption" muted style={styles.ltr}>
                  {item.tracking_number}
                </Text>
                <Text variant="caption" muted>
                  {t('myReports.submittedOn', { date: formatReportDate(item.created_at, locale) })}
                </Text>
              </View>
              <StatusBadge status={item.status} />
            </Pressable>
          );
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 17, fontWeight: '600' },
  // Tracking numbers are Latin/digits: keep them left-to-right in Hebrew and Arabic.
  ltr: { writingDirection: 'ltr', alignSelf: 'flex-start' },
  pressed: { opacity: 0.6 },
});
