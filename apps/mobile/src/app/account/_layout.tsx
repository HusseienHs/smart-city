import { Stack } from 'expo-router';

import { stackScreenOptions } from '@/components/screen-header';
import { useThemeColors } from '@/hooks/use-theme';
import { useI18n } from '@/lib/i18n';

/** Profile sub-screens: personal details, language and notifications. */
export default function AccountLayout() {
  const { t } = useI18n();
  const colors = useThemeColors();
  return (
    <Stack screenOptions={stackScreenOptions(colors)}>
      <Stack.Screen name="details" options={{ title: t('profile.personalDetails') }} />
      <Stack.Screen name="language" options={{ title: t('language.title') }} />
      <Stack.Screen name="notifications" options={{ title: t('profile.notifications') }} />
    </Stack>
  );
}
