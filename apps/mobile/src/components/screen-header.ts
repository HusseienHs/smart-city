import type { ThemeColors } from '@smart-city/shared';

/**
 * Shared look of native stack headers: the bar blends into the page background (no shadow),
 * a minimal back button in the brand color and a bold title.
 */
export function stackScreenOptions(colors: ThemeColors) {
  return {
    headerShown: true,
    headerBackButtonDisplayMode: 'minimal',
    headerTintColor: colors.primary,
    headerStyle: { backgroundColor: colors.background },
    headerTitleStyle: { color: colors.text, fontWeight: '700', fontSize: 17 },
    headerShadowVisible: false,
    contentStyle: { backgroundColor: colors.background },
  } as const;
}

/**
 * Native header options for screens pushed on the root stack (which hides headers by default).
 */
export function screenHeaderOptions(colors: ThemeColors, title: string) {
  return { ...stackScreenOptions(colors), title } as const;
}
