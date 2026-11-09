import { spacing } from '@smart-city/shared';
import { ScrollView, StyleSheet, Switch } from 'react-native';

import { Notice } from '@/components/report/notice';
import { SettingsGroup, SettingsRow } from '@/components/settings-row';
import { Text } from '@/components/text';
import { useI18n } from '@/lib/i18n';

/**
 * Email and phone notification settings. Shown but disabled: the backend has no preference
 * storage and no email/push delivery yet, so nothing is saved and nothing is promised.
 */
export default function NotificationsScreen() {
  const { t } = useI18n();

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text muted>{t('profile.notificationsHint')}</Text>
      <SettingsGroup>
        <SettingsRow
          label={t('profile.emailNotifications')}
          icon="mail-outline"
          detail={t('common.comingSoon')}
          disabled
          accessory={
            <Switch value={false} disabled accessibilityLabel={t('profile.emailNotifications')} />
          }
        />
        <SettingsRow
          label={t('profile.pushNotifications')}
          icon="phone-portrait-outline"
          detail={t('common.comingSoon')}
          disabled
          last
          accessory={
            <Switch value={false} disabled accessibilityLabel={t('profile.pushNotifications')} />
          }
        />
      </SettingsGroup>
      <Notice message={t('profile.notificationsUnavailable')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, gap: spacing.md },
});
