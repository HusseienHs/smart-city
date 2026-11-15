/**
 * Layout metrics of the premium theme. The 4-point spacing scale is the shared one; radii and
 * elevation are softer and larger than the shared defaults, tuned for the redesigned cards.
 */
import { spacing } from '@smart-city/shared';

export { spacing };

export const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
  hero: 32,
  full: 9999,
} as const;

/** Page gutter and readable width (tablets center a column). */
export const layout = {
  gutter: 16,
  gutterWide: 20,
  maxWidth: 640,
  /** Below this window width, 4-up grids fall back to 2×2. */
  compactWidth: 360,
  minTouch: 44,
  tabBarHeight: 64,
} as const;

/** Soft, navy-tinted shadows (shadowColor comes from the theme). */
export const shadow = {
  none: {},
  card: {
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 2,
  },
  raised: {
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6,
  },
  float: {
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 10,
  },
} as const;

/**
 * Same names as the shared tokens (`radii`, `elevation`), so existing screens adopt the premium
 * radii and shadows by importing from here instead of `@smart-city/shared`.
 */
export const radii = {
  sm: radius.sm,
  md: radius.md,
  lg: radius.lg,
  xl: radius.xl,
  full: radius.full,
};
export const elevation = { none: shadow.none, sm: shadow.card, md: shadow.card, lg: shadow.raised };
