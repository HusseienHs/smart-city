import { useEffect } from 'react';
import {
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useThemeColors } from '@/hooks/use-theme';
import { useI18n } from '@/lib/i18n';
import { useMotion } from '@/theme';
import { radius as radii } from '@/theme/metrics';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/** A placeholder block that gently pulses (static when Reduce Motion is on). */
export function Skeleton({ width = '100%', height = 14, radius = radii.sm, style }: SkeletonProps) {
  const colors = useThemeColors();
  const { reduced } = useMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduced) {
      opacity.value = 1;
      return;
    }
    opacity.value = withRepeat(withTiming(0.45, { duration: 800 }), -1, true);
    return () => cancelAnimation(opacity);
  }, [reduced, opacity]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: colors.surfaceMuted },
        animated,
        style,
      ]}
    />
  );
}

/** A card-shaped group of skeleton lines, announced once as "Loading". */
export function SkeletonCard({ lines = 3, height }: { lines?: number; height?: number }) {
  const colors = useThemeColors();
  const { t } = useI18n();
  return (
    <View
      accessible
      accessibilityLabel={t('common.loading')}
      accessibilityRole="progressbar"
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        height ? { height } : null,
      ]}
    >
      <Skeleton width="45%" height={16} />
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} width={index === lines - 1 ? '70%' : '100%'} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    padding: 18,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
