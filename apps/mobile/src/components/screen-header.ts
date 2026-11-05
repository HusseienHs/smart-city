import type { ThemeColors } from '@smart-city/shared';

/**
 * Native header options for screens pushed on the root stack (which hides headers by default):
 * back button only, teal tint, white bar without shadow.
 */
export function screenHeaderOptions(colors: ThemeColors, title: string) {
  return {
    headerShown: true,
    title,
    headerBackButtonDisplayMode: 'minimal',
    headerTintColor: colors.primary,
    headerStyle: { backgroundColor: colors.surface },
    headerTitleStyle: { color: colors.text },
    headerShadowVisible: false,
    contentStyle: { backgroundColor: colors.surface },
  } as const;
}
