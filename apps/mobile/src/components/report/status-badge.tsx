import { radii, spacing, type ReportStatus } from '@smart-city/shared';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { useThemeColors } from '@/hooks/use-theme';
import { useI18n } from '@/lib/i18n';

/** Report status pill: teal while open/resolved, muted when closed, red when rejected. */
export function StatusBadge({ status }: { status: ReportStatus }) {
  const { t } = useI18n();
  const colors = useThemeColors();
  const color =
    status === 'rejected' ? colors.danger : status === 'closed' ? colors.textMuted : colors.primary;
  return (
    <View style={[styles.badge, { backgroundColor: colors.primarySoft, borderColor: color }]}>
      <Text variant="caption" style={[styles.text, { color }]}>
        {t(`reportStatus.${status}`)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: { fontWeight: '600' },
});
