/**
 * Brand design tokens shared by mobile and admin so both apps look like one product.
 * The admin app mirrors these as CSS variables in `apps/admin/src/app/globals.css` —
 * keep them in sync when changing values here.
 */
export const palette = {
  brand: {
    50: '#EEF4FF',
    100: '#D9E6FF',
    500: '#0B5FFF',
    600: '#0049D6',
    700: '#003AAB',
  },
  neutral: {
    0: '#FFFFFF',
    50: '#F7F8FA',
    100: '#EFF1F5',
    200: '#E2E5EB',
    400: '#9AA1AE',
    500: '#6B7280',
    700: '#374151',
    800: '#1F2430',
    900: '#12151C',
    950: '#0A0C10',
  },
  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
} as const;

export const colorSchemes = {
  light: {
    background: palette.neutral[50],
    surface: palette.neutral[0],
    surfaceMuted: palette.neutral[100],
    border: palette.neutral[200],
    text: palette.neutral[900],
    textMuted: palette.neutral[500],
    primary: palette.brand[500],
    primaryPressed: palette.brand[600],
    onPrimary: palette.neutral[0],
    danger: palette.danger,
  },
  dark: {
    background: palette.neutral[950],
    surface: palette.neutral[900],
    surfaceMuted: palette.neutral[800],
    border: palette.neutral[800],
    text: palette.neutral[50],
    textMuted: palette.neutral[400],
    primary: '#3D7FFF',
    primaryPressed: palette.brand[500],
    onPrimary: palette.neutral[0],
    danger: '#F87171',
  },
} as const;

export type ColorSchemeName = keyof typeof colorSchemes;
export type ThemeColors = { [K in keyof (typeof colorSchemes)['light']]: string };

/** 4-point spacing scale. */
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const radii = { sm: 8, md: 12, lg: 16, xl: 24, full: 9999 } as const;
