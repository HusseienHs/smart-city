import type { Locale } from '@smart-city/shared';
import {
  DarkTheme,
  DefaultTheme,
  LocaleProvider,
  Stack,
  ThemeProvider,
  type Theme,
} from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PendingPhotoRecovery } from '@/components/report/pending-photo-recovery';
import { AuthProvider, useAuth } from '@/lib/auth';
import { I18nProvider, useI18n } from '@/lib/i18n';
import { ReportDraftProvider } from '@/lib/report-draft-context';
import { AppThemeProvider, useAppTheme } from '@/lib/theme';
import { appColorSchemes } from '@/theme/colors';
import { FONT_SOURCES, fontsAvailable, setFontsAvailable } from '@/theme/fonts';
import { fontFamilyFor } from '@/theme/typography';

// Keep the splash screen up until the stored session is restored, so a signed-in user never
// sees the sign-up screen flash by.
void SplashScreen.preventAutoHideAsync();

function navigationTheme(scheme: 'light' | 'dark', locale: Locale): Theme {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const colors = appColorSchemes[scheme];
  // Navigation text (tab labels, header titles) in the app font when it loaded.
  const face = (weight: '400' | '500' | '600' | '700') =>
    fontsAvailable()
      ? { fontFamily: fontFamilyFor(locale, weight), fontWeight: 'normal' as const }
      : base.fonts.regular && { ...base.fonts.regular, fontWeight: weight };
  return {
    ...base,
    fonts: { regular: face('400'), medium: face('500'), bold: face('700'), heavy: face('700') },
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
    },
  };
}

/**
 * The app is only reachable when signed in. Signed-out users land on sign-up and can switch
 * to sign-in; signing in (or out) swaps the available screens automatically. A user who
 * arrives through a password-recovery link must set a new password before the app opens.
 * `auth/callback` (email links) is reachable in every state.
 */
function RootNavigator() {
  const { session, isLoading, isPreview, isRecoveringPassword, hasSignedOut } = useAuth();
  const { direction } = useI18n();
  const isSignedIn = session !== null || isPreview;
  const mustResetPassword = session !== null && isRecoveringPassword;
  // New users start at sign-up; someone who just signed out returns to sign-in.
  const signedOutLanding = hasSignedOut ? '/sign-in' : '/sign-up';

  useEffect(() => {
    if (!isLoading) SplashScreen.hide();
  }, [isLoading]);

  if (isLoading) return null;

  return (
    // The chosen language's direction applies immediately: the root `direction` mirrors all
    // layouts, and LocaleProvider mirrors navigation (headers, tab bar, back gestures).
    <View style={[styles.root, { direction }]}>
      <LocaleProvider direction={direction}>
        {/* A report draft never carries over to another account (cleared when the owner changes). */}
        <ReportDraftProvider owner={session?.user.id ?? (isPreview ? 'preview' : null)}>
          {/* Android: a camera photo delivered after the system restarted the app. */}
          <PendingPhotoRecovery />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Protected
              guard={isSignedIn && !mustResetPassword}
              redirectTo={mustResetPassword ? '/reset-password' : signedOutLanding}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="my-reports" />
              <Stack.Screen name="my-reports/[id]" />
              <Stack.Screen name="notices/[id]" />
              <Stack.Screen name="new-report" />
              <Stack.Screen name="account" />
            </Stack.Protected>
            <Stack.Protected guard={mustResetPassword}>
              <Stack.Screen name="reset-password" />
            </Stack.Protected>
            <Stack.Protected guard={!isSignedIn}>
              <Stack.Screen name="sign-up" />
              <Stack.Screen name="sign-in" />
              <Stack.Screen name="verify-email" />
              <Stack.Screen name="forgot-password" />
            </Stack.Protected>
            <Stack.Screen name="auth/callback" />
          </Stack>
        </ReportDraftProvider>
      </LocaleProvider>
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });

/** Navigation colors and the status bar follow the theme the user chose. */
function ThemedApp() {
  const { scheme } = useAppTheme();
  const { locale } = useI18n();
  return (
    <ThemeProvider value={navigationTheme(scheme, locale)}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <RootNavigator />
    </ThemeProvider>
  );
}

/**
 * Loads the bundled fonts while the splash screen is up. If they fail to load, the app still
 * opens, in the system font.
 */
function FontGate({ children }: { children: React.ReactNode }) {
  const [loaded, error] = useFonts(FONT_SOURCES);
  if (!loaded && !error) return null;
  setFontsAvailable(loaded && !error);
  return children;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <FontGate>
        <AppThemeProvider>
          <I18nProvider>
            <AuthProvider>
              <ThemedApp />
            </AuthProvider>
          </I18nProvider>
        </AppThemeProvider>
      </FontGate>
    </SafeAreaProvider>
  );
}
