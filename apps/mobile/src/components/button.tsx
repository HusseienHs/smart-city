import { radii, spacing } from '@smart-city/shared';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { useThemeColors } from '@/hooks/use-theme';

import { Text } from './text';

interface ButtonProps {
  title: string;
  onPress: () => void;
  /** primary: solid brand color · soft: light brand tint · secondary: outlined. */
  variant?: 'primary' | 'soft' | 'secondary';
  loading?: boolean;
  disabled?: boolean;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
}: ButtonProps) {
  const colors = useThemeColors();
  const isPrimary = variant === 'primary';
  const isDisabled = disabled || loading;
  const textColor = isPrimary ? colors.onPrimary : colors.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && {
          backgroundColor: pressed ? colors.primaryPressed : colors.primary,
        },
        variant === 'soft' && {
          backgroundColor: colors.primarySoft,
          opacity: pressed ? 0.7 : 1,
        },
        variant === 'secondary' && {
          borderColor: colors.border,
          backgroundColor: pressed ? colors.surfaceMuted : 'transparent',
        },
        isDisabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.label, { color: textColor }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontWeight: '600', textAlign: 'center' },
  disabled: { opacity: 0.6 },
});
