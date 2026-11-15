import { radii, spacing, type ReportStatus } from '@smart-city/shared';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { useThemeColors } from '@/hooks/use-theme';
import { useI18n } from '@/lib/i18n';

/** The accent and background of a status, so each one is recognizable at a glance. */
export function useStatusColors(status: ReportStatus): { color: string; background: string } {
  const colors = useThemeColors();
  switch (status) {
    case 'rejected':
      return { color: colors.danger, background: colors.dangerSoft };
    case 'closed':
      return { color: colors.textMuted, background: colors.surfaceMuted };
    case 'resolved':
      return { color: colors.success, background: colors.successSoft };
    case 'in_progress':
      return { color: colors.primary, background: colors.primarySoft };
    case 'under_review':
    case 'assigned':
      return { color: colors.warning, background: colors.warningSoft };
    case 'submitted':
      return { color: colors.info, background: colors.infoSoft };
  }
}

/** Report status pill: a colored dot plus the status name (never color alone). */
export function StatusBadge({ status }: { status: ReportStatus }) {
  const { t } = useI18n();
  const { color, background } = useStatusColors(status);
  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text variant="caption" style={[styles.text, { color }]}>
        {t(`reportStatus.${status}`)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radii.full,
  },
  dot: { width: 7, height: 7, borderRadius: radii.full },
  text: { fontWeight: '700', fontSize: 12, lineHeight: 16 },
});
