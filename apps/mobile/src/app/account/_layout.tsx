import { Stack } from 'expo-router';

import { useStackScreenOptions } from '@/components/screen-header';
import { useI18n } from '@/lib/i18n';

/** Profile sub-screens: personal details, language and notifications. */
export default function AccountLayout() {
  const { t } = useI18n();
  const stackOptions = useStackScreenOptions();
  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Screen name="details" options={{ title: t('profile.personalDetails') }} />
      <Stack.Screen name="language" options={{ title: t('language.title') }} />
      <Stack.Screen name="notifications" options={{ title: t('profile.notifications') }} />
    </Stack>
  );
}
