/**
 * The premium design system: one hook for colors, type, metrics and motion.
 *
 * Screens may keep using `useThemeColors()` (now returning `AppColors`); new code uses
 * `useTheme()`.
 */
import { useReducedMotion } from 'react-native-reanimated';
import type { TextStyle } from 'react-native';

import { useI18n } from '@/lib/i18n';
import { useAppTheme } from '@/lib/theme';

import { appColorSchemes, type AppColors } from './colors';
import { fontsAvailable } from './fonts';
import { layout, radius, shadow, spacing } from './metrics';
import { motion } from './motion';
import { fontFamilyFor, type, type TypeVariant } from './typography';

export { appColorSchemes, layout, motion, radius, shadow, spacing, type };
export type { AppColors, TypeVariant };

export function useColors(): AppColors {
  const { scheme } = useAppTheme();
  return appColorSchemes[scheme];
}

/**
 * Font props for a weight in the active language: the bundled face, with `fontWeight` reset so
 * the platform does not synthesize bold on top of it. Falls back to the system font (keeping the
 * weight) when the bundled fonts could not be loaded.
 */
export function useFont(): (weight?: TextStyle['fontWeight']) => TextStyle {
  const { locale } = useI18n();
  return (weight) =>
    fontsAvailable()
      ? { fontFamily: fontFamilyFor(locale, weight ?? '400'), fontWeight: 'normal' }
      : { fontWeight: weight ?? '400' };
}

/** True when animations should be skipped (system "Reduce Motion"). */
export function useMotion(): { reduced: boolean } & typeof motion {
  const reduced = useReducedMotion();
  return { reduced, ...motion };
}

export function useTheme() {
  const { scheme } = useAppTheme();
  const { direction } = useI18n();
  return {
    scheme,
    colors: appColorSchemes[scheme],
    isRTL: direction === 'rtl',
    type,
    radius,
    spacing,
    shadow,
    layout,
  };
}
