import { spacing } from '@smart-city/shared';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';

import { Button } from './button';
import { EmptyState } from './empty-state';

/**
 * Shown instead of personal data when there is no session (e.g. dev preview). Never shows
 * placeholder data. The button leaves preview mode, which opens the sign-in screen.
 */
export function SignInRequired() {
  const { t } = useI18n();
  const { isPreview, exitPreview } = useAuth();
  return (
    <View style={styles.root}>
      <EmptyState
        icon="lock-closed-outline"
        title={t('profile.signInRequiredTitle')}
        description={t('profile.signInRequiredDescription')}
      />
      <Button
        title={t('auth.signIn')}
        onPress={() => (isPreview ? exitPreview() : router.replace('/sign-in'))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.lg },
});
