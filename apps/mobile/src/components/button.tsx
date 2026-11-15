import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useThemeColors } from '@/hooks/use-theme';
import { radius, shadow, spacing } from '@/theme/metrics';

import { Text } from './text';
import { PressableCard } from './ui/pressable-card';

interface ButtonProps {
  title: string;
  onPress: () => void;
  /**
   * primary: solid teal · soft: light teal tint · secondary: outlined ·
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

  const fill = {
    primary: { backgroundColor: colors.primary, shadowColor: colors.primary },
    soft: { backgroundColor: colors.primarySoft },
    danger: { backgroundColor: colors.dangerSoft },
    secondary: { backgroundColor: colors.surface, borderColor: colors.borderStrong },
    ghost: {},
  }[variant];

  const pressedFill = {
    primary: { backgroundColor: colors.primaryPressed },
    soft: { opacity: 0.8 },
    danger: { opacity: 0.8 },
    secondary: { backgroundColor: colors.surfaceMuted },
    ghost: { backgroundColor: colors.primarySoft },
  }[variant];

  return (
    <PressableCard
      onPress={onPress}
      disabled={isDisabled}
      accessibilityLabel={title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        styles.button,
        size === 'lg' && styles.large,
        variant === 'primary' && !isDisabled && styles.glow,
        fill,
        isDisabled && styles.disabled,
      ]}
      pressedStyle={pressedFill}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={styles.content}>
          {icon ? <Ionicons name={icon} size={20} color={textColor} /> : null}
          <Text style={[styles.label, { color: textColor }]}>{title}</Text>
        </View>
      )}
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  large: { minHeight: 58, borderRadius: radius.lg },
  glow: { ...shadow.card, shadowOpacity: 0.22 },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { fontSize: 16, lineHeight: 22, fontWeight: '600', textAlign: 'center' },
  disabled: { opacity: 0.5 },
});
