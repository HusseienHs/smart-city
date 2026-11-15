/**
 * Typography: Noto Sans for each script (Latin, Hebrew, Arabic), bundled as static weights in
 * `assets/fonts` (SIL Open Font License 1.1, see assets/fonts/OFL.txt). Each family also covers
 * Basic Latin, so digits, tracking numbers and e-mail addresses match the surrounding text.
 *
 * React Native needs one family name per weight (Android does not pick weights inside a custom
 * family), so `fontFamilyFor` maps (locale, weight) to the registered name.
 *
 * Pure data (no React Native imports) so it can be unit-tested.
 */
import type { Locale } from '@smart-city/shared';

export const FONT_WEIGHTS = ['Regular', 'Medium', 'SemiBold', 'Bold'] as const;
export type FontWeightName = (typeof FONT_WEIGHTS)[number];

const FAMILY_BY_LOCALE: Record<Locale, string> = {
  en: 'NotoSans',
  he: 'NotoSansHebrew',
  ar: 'NotoSansArabic',
};

/** CSS-like weight → the static file that best matches it. */
export function weightName(weight: string | number | undefined): FontWeightName {
  if (weight === 'bold') return 'Bold';
  const numeric = typeof weight === 'number' ? weight : Number.parseInt(weight ?? '400', 10);
  if (!Number.isFinite(numeric) || numeric < 450) return 'Regular';
  if (numeric < 550) return 'Medium';
  if (numeric < 650) return 'SemiBold';
  return 'Bold';
}

/** Registered family name, e.g. `NotoSansHebrew-SemiBold`. */
export function fontFamilyFor(locale: Locale, weight: string | number | undefined): string {
  return `${FAMILY_BY_LOCALE[locale]}-${weightName(weight)}`;
}

/**
 * Type scale. Line heights leave room for Arabic marks above and below the line; letter spacing
 * stays at 0 (tracking breaks Arabic joining).
 */
export const type = {
  hero: { fontSize: 34, lineHeight: 44, fontWeight: '700' },
  display: { fontSize: 30, lineHeight: 40, fontWeight: '700' },
  title: { fontSize: 26, lineHeight: 36, fontWeight: '700' },
  heading: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  subheading: { fontSize: 17, lineHeight: 25, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 21, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 19, fontWeight: '400' },
  overline: { fontSize: 12, lineHeight: 17, fontWeight: '700' },
  micro: { fontSize: 11, lineHeight: 15, fontWeight: '500' },
  stat: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
} as const;

export type TypeVariant = keyof typeof type;
