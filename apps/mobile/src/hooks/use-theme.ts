import { colorSchemes, type ThemeColors } from '@smart-city/shared';
import { useColorScheme } from 'react-native';

export function useThemeColors(): ThemeColors {
  const scheme = useColorScheme();
  return colorSchemes[scheme === 'dark' ? 'dark' : 'light'];
}
