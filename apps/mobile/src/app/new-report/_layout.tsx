import Ionicons from '@expo/vector-icons/Ionicons';
import { spacing } from '@smart-city/shared';
import { router, Stack } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { LoadingState } from '@/components/load-state';
import { SignInRequired } from '@/components/sign-in-required';
import { useThemeColors } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useReportDraft } from '@/lib/report-draft-context';

// Opening any step directly (e.g. a deep link) still puts the category step underneath it.
export const unstable_settings = { initialRouteName: 'category' };

/**
 * The report submission flow: category → details → location → photos → review → success.
 * The draft lives in ReportDraftProvider (root layout), so back navigation keeps the data.
 */
export default function NewReportLayout() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const { user } = useAuth();
  const { restoring } = useReportDraft();

  // Reports need a real account (dev preview has no session), and a saved draft must be read
  // before any step shows, so a report that was already sent is never offered again as new.
  if (!user || restoring) {
    return (
      <SafeAreaView style={[styles.gate, { backgroundColor: colors.background }]}>
        {user ? <LoadingState /> : <SignInRequired />}
        {!user ? (
          <Button title={t('auth.cancel')} variant="secondary" onPress={() => router.back()} />
        ) : null}
      </SafeAreaView>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackButtonDisplayMode: 'minimal',
        headerTintColor: colors.primary,
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { color: colors.text },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="category"
        options={{
          title: t('reportFlow.steps.category'),
          // First step of a nested stack: there is no automatic back button, so offer a close.
          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel={t('auth.cancel')}
              hitSlop={12}
            >
              <Ionicons name="close" size={26} color={colors.primary} />
            </Pressable>
          ),
        }}
      />
      <Stack.Screen name="details" options={{ title: t('reportFlow.steps.details') }} />
      <Stack.Screen name="location" options={{ title: t('reportFlow.steps.location') }} />
      <Stack.Screen name="photos" options={{ title: t('reportFlow.steps.photos') }} />
      <Stack.Screen name="review" options={{ title: t('reportFlow.steps.review') }} />
      <Stack.Screen
        name="success"
        options={{
          title: t('reportFlow.successTitle'),
          headerBackVisible: false,
          gestureEnabled: false,
        }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  gate: { flex: 1, padding: spacing.xl, gap: spacing.md, justifyContent: 'center' },
});
