import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import type { ComponentProps, PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useThemeColors } from '@/hooks/use-theme';
import { useI18n } from '@/lib/i18n';
import { layout, radius, shadow, spacing } from '@/theme/metrics';

import { Text } from './text';

interface ScreenProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  /** Optional icon badge above the title (e.g. on sign-in and sign-up). */
  icon?: ComponentProps<typeof Ionicons>['name'];
  /** A branded city banner above the title (sign-in and sign-up). */
  banner?: boolean;
}

/** Standard screen scaffold: safe area, large title, scrollable content in a readable column. */
export function Screen({ title, subtitle, icon, banner = false, children }: ScreenProps) {
  const colors = useThemeColors();
  const { t } = useI18n();
  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Keep taps working while the keyboard is open, and scroll focused inputs into view. */}
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <View style={styles.column}>
          {banner ? (
            <View style={[styles.banner, { backgroundColor: colors.hero }]}>
              <Image
                source={require('@/assets/images/home-hero.jpg')}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                cachePolicy="memory-disk"
                accessible={false}
              />
              <View style={[StyleSheet.absoluteFill, { backgroundImage: colors.heroScrim }]} />
              <View style={[styles.bannerMark, { backgroundColor: colors.primary }]}>
                <Ionicons name="business" size={22} color={colors.onPrimary} />
              </View>
              <Text variant="heading" style={{ color: colors.onImage }}>
                {t('app.name')}
              </Text>
              <Text variant="caption" style={{ color: colors.onImageMuted }}>
                {t('citizen.home.tagline')}
              </Text>
            </View>
          ) : null}
          <View style={styles.header}>
            {icon ? (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: colors.primary, shadowColor: colors.primary },
                ]}
              >
                <Ionicons name={icon} size={28} color={colors.onPrimary} />
              </View>
            ) : null}
            <Text variant="title" accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? <Text muted>{subtitle}</Text> : null}
          </View>
          {children}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    paddingHorizontal: layout.gutterWide,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  column: { width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center', gap: spacing.lg },
  header: { gap: spacing.sm, marginBottom: spacing.sm },
  banner: {
    height: 180,
    borderRadius: radius.xl,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: spacing.lg,
    gap: 2,
  },
  bannerMark: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  badge: {
    width: 60,
    height: 60,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    ...shadow.card,
    shadowOpacity: 0.3,
  },
});
