import { elevation, radii, spacing } from '@smart-city/shared';
import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useThemeColors } from '@/hooks/use-theme';

interface CardProps extends PropsWithChildren {
  onPress?: () => void;
  accessibilityLabel?: string;
  /** Removes the inner padding (e.g. for edge-to-edge images or lists). */
  flush?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Surface with a hairline border and soft shadow; pressable when `onPress` is given. */
export function Card({ onPress, accessibilityLabel, flush = false, style, children }: CardProps) {
  const colors = useThemeColors();
  const base = [
    styles.card,
    !flush && styles.padded,
    { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.shadow },
    style,
  ];

  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [base, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    ...elevation.sm,
  },
  padded: { padding: spacing.lg, gap: spacing.md },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
});
