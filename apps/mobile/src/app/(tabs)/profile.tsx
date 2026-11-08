import Ionicons from '@expo/vector-icons/Ionicons';
import { getMyProfile, type MyProfile } from '@smart-city/api';
import { spacing } from '@smart-city/shared';
import type { MessageKey } from '@smart-city/shared/i18n';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Notice } from '@/components/report/notice';
import { SectionHeader, SettingsRow } from '@/components/settings-row';
import { Text } from '@/components/text';
import { useAsync } from '@/hooks/use-async';
import { useThemeColors } from '@/hooks/use-theme';
import { signOut, useAuth } from '@/lib/auth';
import { localizedName, useCities, useNeighborhoods } from '@/lib/home-area';
import { useI18n } from '@/lib/i18n';
import { getSupabase } from '@/lib/supabase';

/** The citizen's profile hub: reports, home area, account settings and sign-out. */
export default function ProfileScreen() {
  const { t, locale } = useI18n();
  const colors = useThemeColors();
  const { user, isPreview, exitPreview } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<MessageKey | null>(null);

  // The real profile (own row only); refreshed quietly whenever the tab comes back into view,
  // e.g. after editing personal details. No session (dev preview) → nothing is loaded or shown.
  const profile = useAsync<MyProfile | null>(user?.id ?? null, () => getMyProfile(getSupabase()));
  const { refresh } = profile;
  useFocusEffect(
    useCallback(() => {
      if (user) refresh();
    }, [user, refresh]),
  );
  const loaded = profile.status === 'success' ? profile.data : null;

  const metadataName: unknown = user?.user_metadata.full_name;
  const name = loaded?.full_name ?? (typeof metadataName === 'string' ? metadataName : '');

  const municipalities = useCities(Boolean(loaded?.home_municipality_id));
  const neighborhoods = useNeighborhoods(
    loaded?.home_neighborhood_id ? loaded.home_municipality_id : null,
  );
  const municipality =
    municipalities.status === 'success'
      ? municipalities.data.find((m) => m.id === loaded?.home_municipality_id)
      : undefined;
  const neighborhood =
    neighborhoods.status === 'success'
      ? neighborhoods.data.find((n) => n.id === loaded?.home_neighborhood_id)
      : undefined;
  const homeArea = [neighborhood, municipality]
    .filter((item) => item !== undefined)
    .map((item) => localizedName(item.name, locale))
    .join(', ');

  async function handleSignOut() {
    setSignOutError(null);
    // Preview has no session to end; a real session is always signed out properly.
    if (isPreview && !user) {
      exitPreview();
      return;
    }
    setSigningOut(true);
    const result = await signOut();
    setSigningOut(false);
    // On success the auth listener clears the session and the root layout opens sign-in.
    if (!result.ok) setSignOutError('profile.signOutError');
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: colors.surface }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text variant="title" accessibilityRole="header">
            {name ? t('profile.greeting', { name }) : t('profile.greetingNoName')}
          </Text>
          {user ? (
            <View style={styles.inline}>
              <Ionicons name="location-outline" size={18} color={colors.textMuted} />
              <Text muted>{homeArea || t('profile.homeAreaNotSet')}</Text>
            </View>
          ) : null}
          {isPreview && !user ? <Notice message={t('auth.previewNotice')} /> : null}
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.list}>
          <SettingsRow
            label={t('profile.myReports')}
            icon="clipboard-outline"
            onPress={() => router.push('/my-reports')}
          />
          <SettingsRow
            label={t('profile.homeArea')}
            icon="location-outline"
            detail={homeArea || undefined}
            onPress={() => router.push('/account/details')}
            last
          />

          <SectionHeader title={t('profile.accountSettings')} />
          <SettingsRow
            label={t('profile.personalDetails')}
            icon="person-outline"
            onPress={() => router.push('/account/details')}
          />
          <SettingsRow
            label={t('profile.language')}
            icon="globe-outline"
            detail={t(`language.${locale}`)}
            onPress={() => router.push('/account/language')}
          />
          <SettingsRow
            label={t('profile.notifications')}
            icon="notifications-outline"
            detail={t('common.comingSoon')}
            onPress={() => router.push('/account/notifications')}
            last
          />

          <SectionHeader title={t('profile.general')} />
          <SettingsRow
            label={signingOut ? t('profile.signingOut') : t('profile.signOut')}
            icon="log-out-outline"
            onPress={handleSignOut}
            loading={signingOut}
            last
          />
          {signOutError ? <Notice tone="error" message={t(signOutError)} /> : null}
        </View>

        <Text variant="caption" muted style={styles.footer}>
          {t('app.name')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingBottom: spacing.xxl },
  header: {
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xl,
  },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  divider: { height: StyleSheet.hairlineWidth },
  list: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  footer: { textAlign: 'center', marginTop: spacing.xxl },
});
