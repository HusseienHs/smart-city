import Ionicons from '@expo/vector-icons/Ionicons';
import { radii, spacing } from '@smart-city/shared';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { useThemeColors } from '@/hooks/use-theme';

import { Text } from './text';

interface ButtonProps {
  title: string;
  onPress: () => void;
  /**
   * primary: solid brand color · soft: light brand tint · secondary: outlined ·
   * ghost: text only · danger: destructive (red tint).
   */
  variant?: 'primary' | 'soft' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'lg';
  /** Optional icon before the label (mirrors with the reading direction). */
  icon?: ComponentProps<typeof Ionicons>['name'];
  loading?: boolean;
  disabled?: boolean;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
}: ButtonProps) {
  const colors = useThemeColors();
  const isDisabled = disabled || loading;

  const textColor =
    variant === 'primary'
      ? colors.onPrimary
      : variant === 'secondary'
        ? colors.text
        : variant === 'danger'
          ? colors.danger
          : colors.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        size === 'lg' && styles.large,
        variant === 'primary' && {
          backgroundColor: pressed ? colors.primaryPressed : colors.primary,
        },
        variant === 'soft' && { backgroundColor: colors.primarySoft },
        variant === 'danger' && { backgroundColor: colors.dangerSoft },
        variant === 'secondary' && {
          borderColor: colors.borderStrong,
          backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
        },
        variant === 'ghost' && pressed && { backgroundColor: colors.primarySoft },
        pressed && variant !== 'primary' && variant !== 'secondary' && styles.pressedSoft,
        pressed && styles.pressed,
        isDisabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={styles.content}>
          {icon ? <Ionicons name={icon} size={20} color={textColor} /> : null}
          <Text style={[styles.label, { color: textColor }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  large: { minHeight: 56, borderRadius: radii.lg },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  pressed: { transform: [{ scale: 0.985 }] },
  pressedSoft: { opacity: 0.75 },
  disabled: { opacity: 0.5 },
});
