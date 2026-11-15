import Ionicons from '@expo/vector-icons/Ionicons';
import type { PublicReport } from '@smart-city/api';
import { StyleSheet, View } from 'react-native';

import { CATEGORY_ICONS } from '@/components/report/category-icons';
import { StatusBadge } from '@/components/report/status-badge';
import { Text } from '@/components/text';
import { IconBadge } from '@/components/ui/icon-badge';
import { useThemeColors } from '@/hooks/use-theme';
import { displayDistance, distanceKm, type Point } from '@/lib/explore';
import { useI18n } from '@/lib/i18n';
import { formatReportDate, toReportCategory } from '@/lib/my-reports';
import { spacing } from '@/theme/metrics';

/**
 * One public report: category, status, the day it was reported, confirmations and the distance
 * from the user. Public data only (no description, address, photos or reporter).
 */
export function PublicReportRow({
  report,
  origin,
  last = false,
}: {
  report: PublicReport;
  origin: Point | null;
  last?: boolean;
}) {
  const { t, locale } = useI18n();
  const colors = useThemeColors();
  const category = toReportCategory(report.category_code);
  const distance = origin ? displayDistance(distanceKm(origin, report)) : null;
  const distanceLabel = distance
    ? t(distance.unit === 'm' ? 'citizen.explore.distanceM' : 'citizen.explore.distanceKm', {
        distance: distance.value,
      })
    : null;
  const date = t('citizen.explore.reportedOn', {
    date: formatReportDate(report.reported_on, locale),
  });

  return (
    <View
      accessible
      accessibilityLabel={[
        t(`reportCategory.${category}`),
        t(`reportStatus.${report.status}`),
        date,
        distanceLabel,
      ]
        .filter(Boolean)
        .join(', ')}
      style={[
        styles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
      ]}
    >
      <IconBadge icon={CATEGORY_ICONS[category]} />
      <View style={styles.text}>
        <View style={styles.top}>
          <Text variant="label" numberOfLines={1} style={styles.flex}>
            {t(`reportCategory.${category}`)}
          </Text>
          <StatusBadge status={report.status} />
        </View>
        <View style={styles.meta}>
          <Text variant="caption" muted>
            {date}
          </Text>
          {report.confirmation_count > 0 ? (
            <View style={styles.inline}>
              <Ionicons name="people-outline" size={13} color={colors.textMuted} />
              <Text variant="caption" muted>
                {t('citizen.explore.confirmations', { count: report.confirmation_count })}
              </Text>
            </View>
          ) : null}
          {distanceLabel ? (
            <View style={styles.inline}>
              <Ionicons name="navigate-outline" size={13} color={colors.textMuted} />
              <Text variant="caption" muted>
                {distanceLabel}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  text: { flex: 1, gap: 4 },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: spacing.md,
    rowGap: 2,
  },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 3 },
});
