import { useAppTheme } from '@/lib/theme';
import { appColorSchemes, type AppColors } from '@/theme/colors';

/**
 * Colors of the theme the user chose (light unless dark mode is turned on in the profile).
 * Returns the premium mobile palette; every shared `ThemeColors` key keeps its meaning.
 */
export function useThemeColors(): AppColors {
  const { scheme } = useAppTheme();
  return appColorSchemes[scheme];
}
