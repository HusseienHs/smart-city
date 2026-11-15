import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Text } from '@/components/text';
import type { IconName } from '@/components/ui/icon';
import { SectionHeader } from '@/components/ui/section-header';
import { useThemeColors } from '@/hooks/use-theme';
import type { ReportSummary } from '@/lib/home-dashboard';
import { useI18n } from '@/lib/i18n';
import { spacing } from '@/theme/metrics';

interface ReportSummaryCardProps {
  summary: ReportSummary;
  onViewAll: () => void;
}

/** "My reports" card: open / in progress / resolved counts of the citizen's own reports. */
export function ReportSummaryCard({ summary, onViewAll }: ReportSummaryCardProps) {
  const { t } = useI18n();
  const colors = useThemeColors();
  const stats: { key: string; label: string; value: number; icon: IconName; color: string }[] = [
    {
      key: 'open',
      label: t('citizen.home.statOpen'),
      value: summary.open,
      icon: 'document-text-outline',
      color: colors.info,
    },
    {
      key: 'progress',
      label: t('citizen.home.statInProgress'),
      value: summary.inProgress,
      icon: 'time-outline',
      color: colors.warning,
    },
    {
      key: 'resolved',
      label: t('citizen.home.statResolved'),
      value: summary.resolved,
      icon: 'checkmark-circle-outline',
      color: colors.success,
    },
  ];

  return (
    <Card>
      <SectionHeader
        title={t('citizen.home.summaryTitle')}
        icon="clipboard-outline"
        action={{ label: t('citizen.home.viewAll'), onPress: onViewAll }}
      />
      {summary.total === 0 ? (
        <Text muted>{t('citizen.home.summaryEmpty')}</Text>
      ) : (
        <View
          style={styles.row}
          accessible
          accessibilityLabel={t('citizen.home.summaryA11y', {
            open: summary.open,
            inProgress: summary.inProgress,
            resolved: summary.resolved,
          })}
        >
          {stats.map((stat, index) => (
            <View
              key={stat.key}
              style={[
                styles.stat,
                index > 0 && {
                  borderStartWidth: StyleSheet.hairlineWidth,
                  borderColor: colors.border,
                },
              ]}
            >
              <Ionicons name={stat.icon} size={26} color={stat.color} />
              <Text variant="caption" muted numberOfLines={1} style={styles.center}>
                {stat.label}
              </Text>
              <Text variant="stat" style={styles.center}>
                {stat.value}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  stat: { flex: 1, alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.xs },
  center: { textAlign: 'center' },
});
