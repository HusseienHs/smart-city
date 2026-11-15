import type { PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useMotion } from '@/theme';

interface FadeInProps extends PropsWithChildren {
  /** Order of the section on the page; later sections start slightly later. */
  index?: number;
  style?: StyleProp<ViewStyle>;
}

/** Fades a section up into place when it first appears. No animation with Reduce Motion. */
export function FadeIn({ index = 0, style, children }: FadeInProps) {
  const { reduced, base } = useMotion();
  return (
    <Animated.View
      style={style}
      entering={reduced ? undefined : FadeInDown.duration(base + 80).delay(Math.min(index, 6) * 50)}
    >
      {children}
    </Animated.View>
  );
}
