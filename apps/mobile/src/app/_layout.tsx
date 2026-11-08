import { colorSchemes } from '@smart-city/shared';
import {
  DarkTheme,
  DefaultTheme,
  LocaleProvider,
  Stack,
  ThemeProvider,
  type Theme,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PendingPhotoRecovery } from '@/components/report/pending-photo-recovery';
import { AuthProvider, useAuth } from '@/lib/auth';
import { I18nProvider, useI18n } from '@/lib/i18n';
import { ReportDraftProvider } from '@/lib/report-draft-context';

// Keep the splash screen up until the stored session is restored, so a signed-in user never
// sees the sign-up screen flash by.
void SplashScreen.preventAutoHideAsync();

function navigationTheme(scheme: 'light' | 'dark'): Theme {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const colors = colorSchemes[scheme];
  return {
    ...base,
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

export default function RootLayout() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';

  return (
    <SafeAreaProvider>
      <I18nProvider>
        <AuthProvider>
          <ThemeProvider value={navigationTheme(scheme)}>
            <StatusBar style="auto" />
            <RootNavigator />
          </ThemeProvider>
        </AuthProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
