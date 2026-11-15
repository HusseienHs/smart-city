/**
 * Brand design tokens shared by mobile and admin so both apps look like one product.
 * The admin app mirrors these as CSS variables in `apps/admin/src/app/globals.css` —
 * keep them in sync when changing values here.
 */
export const palette = {
  brand: {
    50: '#EFFAF9',
    100: '#D3F1EE',
    200: '#A8E2DC',
    300: '#6FCBC3',
    400: '#2FAEA6',
    500: '#0B8A84',
    600: '#077069',
    700: '#085954',
    800: '#0A4744',
    900: '#0B3B39',
  },
  neutral: {
    0: '#FFFFFF',
    50: '#F6F8FA',
    100: '#EEF1F5',
    200: '#E2E7ED',
    300: '#CBD2DB',
    400: '#94A0B0',
    500: '#64707F',
    600: '#4A5563',
    700: '#343D49',
    800: '#1E2530',
    900: '#131820',
    950: '#0A0D12',
  },
  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
  info: '#2563EB',
} as const;

export const colorSchemes = {
  light: {
    background: palette.neutral[50],
    surface: palette.neutral[0],
    surfaceMuted: palette.neutral[100],
    border: palette.neutral[200],
    borderStrong: palette.neutral[300],
    text: palette.neutral[900],
    textMuted: palette.neutral[500],
    primary: palette.brand[500],
    primaryPressed: palette.brand[600],
    primarySoft: palette.brand[50],
    primaryStrong: palette.brand[700],
    onPrimary: palette.neutral[0],
    danger: palette.danger,
    dangerSoft: '#FEF2F2',
    success: palette.success,
    successSoft: '#F0FDF4',
    warning: palette.warning,
    warningSoft: '#FFFBEB',
    info: palette.info,
    infoSoft: '#EFF6FF',
    shadow: '#0F1A2A',
  },
  dark: {
    background: palette.neutral[950],
    surface: palette.neutral[900],
    surfaceMuted: palette.neutral[800],
    border: palette.neutral[800],
    borderStrong: palette.neutral[700],
    text: palette.neutral[50],
    textMuted: palette.neutral[400],
    primary: palette.brand[400],
    primaryPressed: palette.brand[500],
    primarySoft: '#0E2A29',
    primaryStrong: palette.brand[300],
    onPrimary: palette.neutral[0],
    danger: '#F87171',
    dangerSoft: '#2A1414',
    success: '#4ADE80',
    successSoft: '#0F2417',
    warning: '#FBBF24',
    warningSoft: '#2A2010',
    info: '#60A5FA',
    infoSoft: '#111E33',
    shadow: '#000000',
  },
} as const;

export type ColorSchemeName = keyof typeof colorSchemes;
export type ThemeColors = { [K in keyof (typeof colorSchemes)['light']]: string };

/** 4-point spacing scale. */
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const radii = { sm: 8, md: 12, lg: 16, xl: 24, full: 9999 } as const;

/** Type scale (font size / line height in points). */
export const typography = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -0.6 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.4 },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '700', letterSpacing: -0.2 },
  subheading: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 23, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 19, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  overline: { fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.6 },
} as const;

/** Soft, layered elevation for cards and floating controls (React Native shadow props). */
export const elevation = {
  none: {},
  sm: {
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  lg: {
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 8,
  },
} as const;
