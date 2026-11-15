import Ionicons from '@expo/vector-icons/Ionicons';
import { radii, spacing } from '@smart-city/shared';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { useThemeColors } from '@/hooks/use-theme';

interface NoticeProps {
  message: string;
  tone?: 'info' | 'error' | 'success' | 'warning';
  icon?: ComponentProps<typeof Ionicons>['name'];
}

const DEFAULT_ICONS = {
  info: 'information-circle',
  error: 'alert-circle',
  success: 'checkmark-circle',
  warning: 'warning',
} as const;

/** Inline banner for hints (info), form or submission errors (error) and confirmations. */
export function Notice({ message, tone = 'info', icon }: NoticeProps) {
  const colors = useThemeColors();
  const tones = {
    info: { color: colors.primary, background: colors.primarySoft },
    error: { color: colors.danger, background: colors.dangerSoft },
    success: { color: colors.success, background: colors.successSoft },
    warning: { color: colors.warning, background: colors.warningSoft },
  };
  const { color, background } = tones[tone];
  return (
    <View
      style={[styles.root, { backgroundColor: background, borderColor: `${color}33` }]}
      accessibilityRole={tone === 'error' ? 'alert' : 'text'}
      accessibilityLiveRegion={tone === 'error' ? 'polite' : 'none'}
    >
      <Ionicons name={icon ?? DEFAULT_ICONS[tone]} size={20} color={color} />
      <Text variant="caption" style={[styles.text, { color: colors.text }]}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  text: { flex: 1, fontSize: 14, lineHeight: 20 },
});
