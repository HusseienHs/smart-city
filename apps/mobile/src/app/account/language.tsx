import Ionicons from '@expo/vector-icons/Ionicons';
import { updateMyProfile } from '@smart-city/api';
import { spacing, SUPPORTED_LOCALES, type Locale } from '@smart-city/shared';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Notice } from '@/components/report/notice';
import { SettingsGroup, SettingsRow } from '@/components/settings-row';
import { Text } from '@/components/text';
import { useThemeColors } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { getSupabase } from '@/lib/supabase';

type SyncState = { status: 'idle' } | { status: 'syncing' } | { status: 'error'; locale: Locale };

/**
 * Language picker. The switch is immediate (texts, direction, navigation) and remembered on
 * this device; when signed in it is also saved to the profile (`preferred_locale`). A failed
 * save never undoes the local switch: it shows a retry instead.
 */
export default function LanguageScreen() {
  const { t, locale, setLocale } = useI18n();
  const { user } = useAuth();
  const colors = useThemeColors();
  const [sync, setSync] = useState<SyncState>({ status: 'idle' });

  async function saveToProfile(next: Locale) {
    if (!user) return;
    setSync({ status: 'syncing' });
    try {
      await updateMyProfile(getSupabase(), { preferredLocale: next });
      setSync({ status: 'idle' });
    } catch {
      setSync({ status: 'error', locale: next });
    }
  }

  function choose(next: Locale) {
    if (next === locale) return;
    setLocale(next);
    void saveToProfile(next);
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text muted>{t('language.hint')}</Text>
      <View accessibilityRole="radiogroup">
        <SettingsGroup>
          {SUPPORTED_LOCALES.map((option, index) => {
            const selected = option === locale;
            return (
              <SettingsRow
                key={option}
                // Each language is shown in its own name and script.
                label={t(`language.${option}`)}
                icon="globe-outline"
                onPress={() => choose(option)}
                last={index === SUPPORTED_LOCALES.length - 1}
                accessory={
                  <Ionicons
                    name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={24}
                    color={colors.primary}
                  />
                }
              />
            );
          })}
        </SettingsGroup>
      </View>

      {sync.status === 'syncing' ? (
        <Text variant="caption" muted accessibilityLiveRegion="polite">
          {t('profile.languageSyncing')}
        </Text>
      ) : null}
      {sync.status === 'error' ? (
        <View style={styles.error}>
          <Notice tone="error" message={t('profile.languageSyncError')} />
          <Button
            title={t('common.retry')}
            variant="soft"
            onPress={() => void saveToProfile(sync.locale)}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, gap: spacing.md },
  error: { gap: spacing.md },
});
