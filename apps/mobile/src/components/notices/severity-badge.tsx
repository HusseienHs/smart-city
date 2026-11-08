import Ionicons from '@expo/vector-icons/Ionicons';
import { palette, radii, spacing } from '@smart-city/shared';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { useThemeColors } from '@/hooks/use-theme';
import { useI18n } from '@/lib/i18n';
import type { AnnouncementSeverity } from '@/lib/notice-board';

type IconName = ComponentProps<typeof Ionicons>['name'];

const ICONS: Readonly<Record<AnnouncementSeverity, IconName>> = {
  emergency: 'warning',
  important: 'alert-circle',
  info: 'information-circle',
};

/** The accent color of a severity (also used for the highlighted card edge). */
export function useSeverityColor(severity: AnnouncementSeverity): string {
  const colors = useThemeColors();
  if (severity === 'emergency') return colors.danger;
  if (severity === 'important') return palette.warning;
  return colors.primary;
}

/** "Emergency" / "Important" / "General": icon plus text, never color alone. */
export function SeverityBadge({ severity }: { severity: AnnouncementSeverity }) {
  const { t } = useI18n();
  const color = useSeverityColor(severity);
  return (
    <View style={[styles.badge, { backgroundColor: `${color}1A` }]}>
      <Ionicons name={ICONS[severity]} size={14} color={color} />
      <Text variant="caption" style={[styles.label, { color }]}>
        {t(`notices.severity.${severity}`)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.full,
  },
  label: { fontWeight: '600' },
});
