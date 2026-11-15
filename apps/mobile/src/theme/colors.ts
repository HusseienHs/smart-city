/**
 * The mobile app's premium color themes: Midnight Navy ink, Emerald Teal accents and Ivory
 * surfaces. Built only from the shared palette (`@smart-city/shared` design tokens), so mobile and
 * admin stay one brand while mobile gets its own, richer look.
 *
 * Every key of the shared `ThemeColors` is kept with the same meaning, so all existing screens
 * pick up the new look automatically. The extra keys serve the redesigned surfaces.
 *
 * Pure data (no React Native imports): the contrast test loads this file directly.
 */
import { palette, type ThemeColors } from '@smart-city/shared';

export interface AppColors extends ThemeColors {
  /** Raised surface on top of `surface` (sheets, popovers, the tab bar). */
  surfaceRaised: string;
  /** Text on top of images and the navy hero. */
  onImage: string;
  onImageMuted: string;
  /** Navy hero fallback behind images while they load. */
  hero: string;
  /** Linear gradients (CSS syntax, native `backgroundImage`) that keep text on photos legible. */
  heroScrim: string;
  /** Fades a card's photo into the card surface, toward the reading start. */
  mediaFadeLtr: string;
  mediaFadeRtl: string;
  /** Active tab pill background. */
  tabActive: string;
  /** A notification dot. */
  badge: string;
  /** Translucent glass on photos (chips, buttons over the hero). */
  glass: string;
  glassBorder: string;
}

const { brand, navy, ivory, neutral } = palette;

export const appColorSchemes: Record<'light' | 'dark', AppColors> = {
  light: {
    background: ivory[100],
    surface: neutral[0],
    surfaceMuted: ivory[200],
    surfaceRaised: neutral[0],
    border: '#E4E1D8',
    borderStrong: ivory[300],
    text: navy[900],
    textMuted: '#55636F',
    // brand-600: legible as text on white/ivory and as a fill behind white text.
    primary: brand[600],
    primaryPressed: brand[700],
    primarySoft: brand[50],
    primaryStrong: brand[700],
    onPrimary: neutral[0],
    danger: '#C62828',
    dangerSoft: '#FDF0EF',
    success: '#16794A',
    successSoft: '#EDF8F1',
    warning: '#B45309',
    warningSoft: '#FEF6E7',
    info: '#1D5FC9',
    infoSoft: '#EEF4FD',
    shadow: navy[900],
    onImage: neutral[0],
    onImageMuted: 'rgba(255, 255, 255, 0.86)',
    hero: navy[800],
    heroScrim:
      'linear-gradient(180deg, rgba(6, 16, 28, 0.55) 0%, rgba(6, 16, 28, 0.15) 38%, rgba(6, 16, 28, 0.78) 100%)',
    mediaFadeLtr: 'linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 1) 92%)',
    mediaFadeRtl: 'linear-gradient(270deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 1) 92%)',
    tabActive: brand[50],
    badge: '#E5484D',
    glass: 'rgba(10, 24, 40, 0.38)',
    glassBorder: 'rgba(255, 255, 255, 0.28)',
  },
  dark: {
    background: navy[950],
    surface: navy[900],
    surfaceMuted: navy[800],
    surfaceRaised: navy[800],
    border: '#1A2D42',
    borderStrong: navy[600],
    text: '#EEF2F6',
    textMuted: '#9AABBD',
    // A brighter teal on navy; filled controls carry dark ink (onPrimary) for contrast.
    primary: brand[400],
    primaryPressed: brand[300],
    primarySoft: '#0D2B2F',
    primaryStrong: brand[300],
    onPrimary: navy[950],
    danger: '#F87171',
    dangerSoft: '#2A1518',
    success: '#4ADE80',
    successSoft: '#0E2A1D',
    warning: '#FBBF24',
    warningSoft: '#2A2111',
    info: '#7AB0FF',
    infoSoft: '#0F2240',
    shadow: '#000000',
    onImage: neutral[0],
    onImageMuted: 'rgba(255, 255, 255, 0.86)',
    hero: navy[900],
    heroScrim:
      'linear-gradient(180deg, rgba(3, 9, 16, 0.6) 0%, rgba(3, 9, 16, 0.22) 38%, rgba(3, 9, 16, 0.85) 100%)',
    mediaFadeLtr: 'linear-gradient(90deg, rgba(10, 24, 40, 0) 0%, rgba(10, 24, 40, 1) 92%)',
    mediaFadeRtl: 'linear-gradient(270deg, rgba(10, 24, 40, 0) 0%, rgba(10, 24, 40, 1) 92%)',
    tabActive: '#0D2B2F',
    badge: '#FF6369',
    glass: 'rgba(3, 9, 16, 0.45)',
    glassBorder: 'rgba(255, 255, 255, 0.18)',
  },
};
