import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { useThemeColors } from '@/hooks/use-theme';
import { radius } from '@/theme/metrics';

import type { IconName } from './icon';

interface IconBadgeProps {
  icon: IconName;
  size?: 'sm' | 'md' | 'lg';
  /** Icon color; the tile uses the matching soft tint. Defaults to the brand teal. */
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  shape?: 'rounded' | 'circle';
}

const SIZES = { sm: { box: 32, icon: 17 }, md: { box: 42, icon: 21 }, lg: { box: 56, icon: 28 } };

/** A tinted tile holding an icon (list rows, stats, empty states). Decorative for screen readers. */
export function IconBadge({
  icon,
  size = 'md',
  tone = 'primary',
  shape = 'rounded',
}: IconBadgeProps) {
  const colors = useThemeColors();
  const palette = {
    primary: [colors.primary, colors.primarySoft],
    success: [colors.success, colors.successSoft],
    warning: [colors.warning, colors.warningSoft],
    danger: [colors.danger, colors.dangerSoft],
    info: [colors.info, colors.infoSoft],
    neutral: [colors.textMuted, colors.surfaceMuted],
  } as const;
  const [color, background] = palette[tone];
  const { box, icon: iconSize } = SIZES[size];
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.tile,
        {
          width: box,
          height: box,
          borderRadius: shape === 'circle' ? radius.full : box * 0.3,
          backgroundColor: background,
        },
      ]}
    >
      <Ionicons name={icon} size={iconSize} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center' },
});
