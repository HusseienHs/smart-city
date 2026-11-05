import Ionicons from '@expo/vector-icons/Ionicons';
import { spacing } from '@smart-city/shared';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { useThemeColors } from '@/hooks/use-theme';

import { Text } from './text';

type IconName = ComponentProps<typeof Ionicons>['name'];

interface SettingsRowProps {
  label: string;
  icon: IconName;
  onPress?: () => void;
  /** Secondary text under the label (e.g. the current language). */
  detail?: string;
  /** Replaces the icon with a spinner. */
  loading?: boolean;
  disabled?: boolean;
  /** Custom control instead of the icon (e.g. a switch). */
  accessory?: ReactNode;
  last?: boolean;
}

/**
 * A row of the profile list: label at the start, a thin outlined icon at the end, and a hairline
 * separator, mirroring with the reading direction.
 */
export function SettingsRow({
  label,
  icon,
  onPress,
  detail,
  loading = false,
  disabled = false,
  accessory,
  last = false,
}: SettingsRowProps) {
  const colors = useThemeColors();
  const content = (
    <>
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        {detail ? (
          <Text variant="caption" muted>
            {detail}
          </Text>
        ) : null}
      </View>
      {accessory ??
        (loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Ionicons name={icon} size={24} color={colors.text} />
        ))}
    </>
  );
  const rowStyle = [
    styles.row,
    !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
  ];

  if (!onPress) {
    return (
      <View style={[rowStyle, disabled && styles.disabled]} accessible accessibilityLabel={label}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={({ pressed }) => [rowStyle, (pressed || disabled) && styles.disabled]}
    >
      {content}
    </Pressable>
  );
}

export function SectionHeader({ title }: { title: string }) {
  return (
    <Text variant="caption" muted style={styles.section} accessibilityRole="header">
      {title}
    </Text>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 60,
    paddingVertical: spacing.md,
  },
  text: { flex: 1, gap: 2 },
  label: { fontSize: 17 },
  disabled: { opacity: 0.5 },
  section: { marginTop: spacing.xl, marginBottom: spacing.xs },
});
