/**
 * The bundled Noto Sans faces, keyed by the family names `fontFamilyFor` produces. Loaded once at
 * startup (root layout) while the splash screen is up.
 *
 * If loading fails, the app keeps working with the system font: `setFontsAvailable(false)` makes
 * every text style omit `fontFamily`.
 */
export const FONT_SOURCES = {
  'NotoSans-Regular': require('@/assets/fonts/NotoSans-Regular.ttf'),
  'NotoSans-Medium': require('@/assets/fonts/NotoSans-Medium.ttf'),
  'NotoSans-SemiBold': require('@/assets/fonts/NotoSans-SemiBold.ttf'),
  'NotoSans-Bold': require('@/assets/fonts/NotoSans-Bold.ttf'),
  'NotoSansHebrew-Regular': require('@/assets/fonts/NotoSansHebrew-Regular.ttf'),
  'NotoSansHebrew-Medium': require('@/assets/fonts/NotoSansHebrew-Medium.ttf'),
  'NotoSansHebrew-SemiBold': require('@/assets/fonts/NotoSansHebrew-SemiBold.ttf'),
  'NotoSansHebrew-Bold': require('@/assets/fonts/NotoSansHebrew-Bold.ttf'),
  'NotoSansArabic-Regular': require('@/assets/fonts/NotoSansArabic-Regular.ttf'),
  'NotoSansArabic-Medium': require('@/assets/fonts/NotoSansArabic-Medium.ttf'),
  'NotoSansArabic-SemiBold': require('@/assets/fonts/NotoSansArabic-SemiBold.ttf'),
  'NotoSansArabic-Bold': require('@/assets/fonts/NotoSansArabic-Bold.ttf'),
} as const;

let available = false;

export function setFontsAvailable(value: boolean): void {
  available = value;
}

export function fontsAvailable(): boolean {
  return available;
}
