import Ionicons from '@expo/vector-icons/Ionicons';
import { radii, spacing } from '@smart-city/shared';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { useThemeColors } from '@/hooks/use-theme';

interface NoticeProps {
  message: string;
  tone?: 'info' | 'error';
  icon?: ComponentProps<typeof Ionicons>['name'];
}

/** Inline banner for demo notices (info) and form or submission errors (error). */
export function Notice({ message, tone = 'info', icon }: NoticeProps) {
  const colors = useThemeColors();
  const color = tone === 'error' ? colors.danger : colors.primary;
  return (
    <View
      style={[styles.root, { backgroundColor: colors.primarySoft, borderColor: color }]}
      accessibilityRole={tone === 'error' ? 'alert' : 'text'}
      accessibilityLiveRegion={tone === 'error' ? 'polite' : 'none'}
    >
      <Ionicons
        name={icon ?? (tone === 'error' ? 'alert-circle-outline' : 'information-circle-outline')}
        size={20}
        color={color}
      />
      <Text
        variant="caption"
        style={[styles.text, { color: tone === 'error' ? color : colors.text }]}
      >
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: { flex: 1 },
});
