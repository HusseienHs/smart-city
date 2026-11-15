import Ionicons from '@expo/vector-icons/Ionicons';
import { elevation, radii, spacing } from '@smart-city/shared';
import type { MessageKey } from '@smart-city/shared/i18n';
import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { useThemeColors } from '@/hooks/use-theme';
import { useI18n } from '@/lib/i18n';

interface QuickAction {
  label: MessageKey;
  hint: MessageKey;
  icon: ComponentProps<typeof Ionicons>['name'];
  href: Href;
}

const QUICK_ACTIONS: readonly QuickAction[] = [
  {
    label: 'home.myReports',
    hint: 'home.myReportsHint',
    icon: 'clipboard-outline',
    href: '/my-reports',
  },
  {
    label: 'home.noticeBoard',
    hint: 'home.noticeBoardHint',
    icon: 'megaphone-outline',
    href: '/notices',
  },
  { label: 'home.events', hint: 'home.eventsHint', icon: 'calendar-outline', href: '/events' },
  {
    label: 'home.myAccount',
    hint: 'home.myAccountHint',
    icon: 'person-circle-outline',
    href: '/profile',
  },
];

/** Home: the main task (report an issue) up front, then quick links to everything else. */
export default function HomeScreen() {
  const { t, direction } = useI18n();
  const colors = useThemeColors();
  const arrow = direction === 'rtl' ? 'arrow-back' : 'arrow-forward';

  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={[styles.logo, { backgroundColor: colors.primary }]}>
              <Ionicons name="business" size={16} color={colors.onPrimary} />
            </View>
            <Text variant="label" style={{ color: colors.primary }}>
              {t('app.name')}
            </Text>
          </View>
          <Text variant="display" accessibilityRole="header">
            {t('home.title')}
          </Text>
        </View>

        {/* Primary action: a large photo card that starts a report. */}
        <Pressable
          onPress={() => router.push('/report')}
          accessibilityRole="button"
          accessibilityLabel={`${t('home.reportIssue')}. ${t('home.reportIssueHint')}`}
          style={({ pressed }) => [
            styles.hero,
            { backgroundColor: colors.primaryStrong, shadowColor: colors.shadow },
            pressed && styles.pressed,
          ]}
        >
          <Image
            source={require('@/assets/images/home-hero.jpg')}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            accessible={false}
          />
          <View style={styles.heroShade} />
          <View style={styles.heroBody}>
            <View style={styles.heroBadge}>
              <Ionicons name="flash" size={14} color="#FFFFFF" />
              <Text variant="caption" style={styles.heroBadgeText}>
                {t('app.tagline')}
              </Text>
            </View>
            <View style={styles.heroFooter}>
              <View style={styles.flex}>
                <Text variant="heading" style={styles.onImage}>
                  {t('home.reportIssue')}
                </Text>
                <Text variant="caption" style={styles.onImageMuted}>
                  {t('home.reportIssueHint')}
                </Text>
              </View>
              <View style={[styles.heroCta, { backgroundColor: colors.primary }]}>
                <Ionicons name={arrow} size={22} color={colors.onPrimary} />
              </View>
            </View>
          </View>
        </Pressable>

        <Text variant="overline" muted accessibilityRole="header" style={styles.sectionLabel}>
          {t('home.quickActions')}
        </Text>

        <View style={styles.grid}>
          {QUICK_ACTIONS.map((action) => (
            <Pressable
              key={action.label}
              onPress={() => router.push(action.href)}
              accessibilityRole="button"
              accessibilityLabel={`${t(action.label)}. ${t(action.hint)}`}
              style={({ pressed }) => [
                styles.tile,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  shadowColor: colors.shadow,
                },
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.tileIcon, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name={action.icon} size={22} color={colors.primary} />
              </View>
              <View style={styles.tileText}>
                <Text variant="subheading" numberOfLines={1}>
                  {t(action.label)}
                </Text>
                <Text variant="caption" muted numberOfLines={2}>
                  {t(action.hint)}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxxl },
  header: { gap: spacing.sm, marginBottom: spacing.xs },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logo: {
    width: 26,
    height: 26,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    height: 220,
    borderRadius: radii.xl,
    overflow: 'hidden',
    ...elevation.md,
  },
  heroShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(8, 20, 28, 0.45)' },
  heroBody: { flex: 1, justifyContent: 'space-between', padding: spacing.lg },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  heroBadgeText: { color: '#FFFFFF', fontWeight: '600' },
  heroFooter: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  onImage: { color: '#FFFFFF' },
  onImageMuted: { color: 'rgba(255, 255, 255, 0.85)' },
  heroCta: {
    width: 48,
    height: 48,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1, gap: 2 },
  sectionLabel: { marginTop: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    ...elevation.sm,
  },
  tileIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileText: { gap: 2 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
});
