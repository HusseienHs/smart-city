import { useThemeColors } from '@/hooks/use-theme';
import { useFont } from '@/theme';

/**
 * Shared look of native stack headers: the bar blends into the page background (no shadow),
 * a minimal back button in the brand color and a bold title in the app font.
 */
export function useStackScreenOptions() {
  const colors = useThemeColors();
  const font = useFont();
  const title = font('700');
  return {
    headerShown: true,
    headerBackButtonDisplayMode: 'minimal',
    headerTintColor: colors.primary,
    headerStyle: { backgroundColor: colors.background },
    headerTitleStyle: {
      color: colors.text,
      fontSize: 17,
      ...(title.fontFamily ? { fontFamily: title.fontFamily } : { fontWeight: '700' as const }),
    },
    headerShadowVisible: false,
    contentStyle: { backgroundColor: colors.background },
  } as const;
}

/**
 * Native header options for screens pushed on the root stack (which hides headers by default).
 */
export function useScreenHeaderOptions(title: string) {
  return { ...useStackScreenOptions(), title } as const;
}
