import { Stack } from 'expo-router';

import { useThemeColors } from '@/hooks/use-theme';
import { useI18n } from '@/lib/i18n';

/** Profile sub-screens: personal details, language and notifications. */
export default function AccountLayout() {
  const { t } = useI18n();
  const colors = useThemeColors();
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackButtonDisplayMode: 'minimal',
        headerTintColor: colors.primary,
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { color: colors.text },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.surface },
      }}
    >
      <Stack.Screen name="details" options={{ title: t('profile.personalDetails') }} />
      <Stack.Screen name="language" options={{ title: t('language.title') }} />
      <Stack.Screen name="notifications" options={{ title: t('profile.notifications') }} />
    </Stack>
  );
}
