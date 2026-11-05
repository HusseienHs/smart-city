import Ionicons from '@expo/vector-icons/Ionicons';
import { radii, spacing } from '@smart-city/shared';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useThemeColors } from '@/hooks/use-theme';
import { signOut, useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';

export default function ProfileScreen() {
  const { t } = useI18n();
  const colors = useThemeColors();
  // The tabs are only reachable when signed in (see the root layout).
  const { user, isPreview, exitPreview } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const fullName: unknown = user?.user_metadata.full_name;

  async function handleSignOut() {
    if (isPreview) {
      exitPreview();
      return;
    }
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
  }

  return (
    <Screen title={t('mobileTabs.profile')} subtitle={t('mobileScreens.profileSubtitle')}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="person-circle" size={48} color={colors.primary} />
        <View style={styles.cardText}>
          {typeof fullName === 'string' && fullName ? (
            <Text variant="heading">{fullName}</Text>
          ) : null}
          <Text muted>
            {isPreview
              ? t('auth.previewNotice')
              : t('auth.signedInAs', { email: user?.email ?? '' })}
          </Text>
        </View>
      </View>
      <Button
        title={t('auth.signOut')}
        variant="secondary"
        onPress={handleSignOut}
        loading={signingOut}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardText: { flex: 1, gap: spacing.xs },
});
