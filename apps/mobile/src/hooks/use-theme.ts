import { colorSchemes, type ThemeColors } from '@smart-city/shared';

import { useAppTheme } from '@/lib/theme';

/** Colors of the theme the user chose (light unless dark mode is turned on in the profile). */
export function useThemeColors(): ThemeColors {
  const { scheme } = useAppTheme();
  return colorSchemes[scheme];
}
