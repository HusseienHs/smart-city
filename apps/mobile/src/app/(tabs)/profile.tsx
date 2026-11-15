import Ionicons from '@expo/vector-icons/Ionicons';
import { getMyProfile, type MyProfile } from '@smart-city/api';
import { radii, spacing } from '@smart-city/shared';
import type { MessageKey } from '@smart-city/shared/i18n';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Notice } from '@/components/report/notice';
import { SectionHeader, SettingsGroup, SettingsRow } from '@/components/settings-row';
import { Text } from '@/components/text';
import { useAsync } from '@/hooks/use-async';
import { useThemeColors } from '@/hooks/use-theme';
import { signOut, useAuth } from '@/lib/auth';
import { localizedName, useCities, useNeighborhoods } from '@/lib/home-area';
import { useI18n } from '@/lib/i18n';
import { getSupabase } from '@/lib/supabase';
import { useAppTheme } from '@/lib/theme';

/** The citizen's profile hub: reports, home area, account settings and sign-out. */
export default function ProfileScreen() {
  const { t, locale } = useI18n();
  const colors = useThemeColors();
  const { scheme, setScheme } = useAppTheme();
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

  function toggleDarkMode() {
    setScheme(scheme === 'dark' ? 'light' : 'dark');
  }

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

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text variant="title" accessibilityRole="header" style={styles.pageTitle}>
          {t('mobileTabs.profile')}
        </Text>

        <View
          style={[styles.identity, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            {initials ? (
              <Text style={[styles.initials, { color: colors.onPrimary }]}>{initials}</Text>
            ) : (
              <Ionicons name="person" size={28} color={colors.onPrimary} />
            )}
          </View>
          <View style={styles.identityText}>
            <Text variant="heading" numberOfLines={1}>
              {name ? t('profile.greeting', { name }) : t('profile.greetingNoName')}
            </Text>
            {user ? (
              <View style={styles.inline}>
                <Ionicons name="location-outline" size={15} color={colors.textMuted} />
                <Text variant="caption" muted numberOfLines={1} style={styles.flex}>
                  {homeArea || t('profile.homeAreaNotSet')}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        {isPreview && !user ? <Notice message={t('auth.previewNotice')} /> : null}

        <View style={styles.sectionGap} />
        <SettingsGroup>
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
        </SettingsGroup>

        <SectionHeader title={t('profile.accountSettings')} />
        <SettingsGroup>
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
            label={t('common.darkMode')}
            icon={scheme === 'dark' ? 'moon' : 'moon-outline'}
            onPress={toggleDarkMode}
            accessory={
              <Switch
                value={scheme === 'dark'}
                onValueChange={toggleDarkMode}
                trackColor={{ true: colors.primary, false: colors.borderStrong }}
                accessibilityLabel={t('common.darkMode')}
              />
            }
          />
          <SettingsRow
            label={t('profile.notifications')}
            icon="notifications-outline"
            detail={t('common.comingSoon')}
            onPress={() => router.push('/account/notifications')}
            last
          />
        </SettingsGroup>

        <SectionHeader title={t('profile.general')} />
        <SettingsGroup>
          <SettingsRow
            label={signingOut ? t('profile.signingOut') : t('profile.signOut')}
            icon="log-out-outline"
            onPress={handleSignOut}
            loading={signingOut}
            tone="danger"
            last
          />
        </SettingsGroup>
        {signOutError ? (
          <View style={styles.sectionGap}>
            <Notice tone="error" message={t(signOutError)} />
          </View>
        ) : null}

        <Text variant="caption" muted style={styles.footer}>
          {t('app.name')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  pageTitle: { marginBottom: spacing.lg },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontSize: 22, fontWeight: '700' },
  identityText: { flex: 1, gap: spacing.xs },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  flex: { flex: 1 },
  sectionGap: { marginTop: spacing.lg },
  footer: { textAlign: 'center', marginTop: spacing.xxl },
});
