import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useThemeColors } from '@/hooks/use-theme';
import { radius, shadow, spacing } from '@/theme/metrics';

import { PressableCard } from './ui/pressable-card';

interface CardProps extends PropsWithChildren {
  onPress?: () => void;
  accessibilityLabel?: string;
  /** Removes the inner padding (e.g. for edge-to-edge images or lists). */
  flush?: boolean;
  /** `raised` adds a deeper shadow for the page's key card. */
  elevation?: 'card' | 'raised';
  style?: StyleProp<ViewStyle>;
}

/** Premium surface: hairline border, soft navy shadow; pressable when `onPress` is given. */
export function Card({
  onPress,
  accessibilityLabel,
  flush = false,
  elevation = 'card',
  style,
  children,
}: CardProps) {
  const colors = useThemeColors();
  const base = [
    styles.card,
    shadow[elevation],
    !flush && styles.padded,
    { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.shadow },
    style,
  ];

  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <PressableCard onPress={onPress} accessibilityLabel={accessibilityLabel} style={base}>
      {children}
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  padded: { padding: spacing.lg + 2, gap: spacing.md },
});
