import type { PropsWithChildren } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { useMotion } from '@/theme';

interface PressableCardProps extends Omit<PressableProps, 'style' | 'children'>, PropsWithChildren {
  style?: StyleProp<ViewStyle>;
  /** Extra style while pressed (e.g. a darker fill). */
  pressedStyle?: StyleProp<ViewStyle>;
}

/**
 * Pressable with the design system's press feedback: a slight scale-down, or only a dimming when
 * Reduce Motion is on. Defaults to the button role.
 */
export function PressableCard({ style, pressedStyle, children, ...props }: PressableCardProps) {
  const { reduced, pressScale } = useMotion();
  return (
    <Pressable
      accessibilityRole="button"
      {...props}
      style={({ pressed }) => [
        style,
        pressed && (reduced ? { opacity: 0.8 } : { transform: [{ scale: pressScale }] }),
        pressed && pressedStyle,
      ]}
    >
      {children}
    </Pressable>
  );
}
