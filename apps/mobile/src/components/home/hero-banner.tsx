import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, type ImageSource } from 'expo-image';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { forwardChevron } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { PressableCard } from '@/components/ui/pressable-card';
import { useThemeColors } from '@/hooks/use-theme';
import { useI18n } from '@/lib/i18n';
import { layout, radius, shadow, spacing } from '@/theme/metrics';

/** The bundled, licensed generic city photo (see assets/images/CREDITS.md). */
const DEFAULT_HERO: ImageSource = require('@/assets/images/home-hero.jpg');

interface HeroBannerProps {
  greeting: string;
  /** "Municipality of …" under the emblem; null while unknown or without a home city. */
  municipalityLabel: string | null;
  /** The city chip text (the home city, or "Choose your city"). */
  cityLabel: string;
  cityAccessibilityLabel: string;
  onCityPress: () => void;
  hasUnseenUpdates: boolean;
  onUpdatesPress: () => void;
  onReportPress: () => void;
  /**
   * A municipality-specific photo, when one becomes available (must be licensed). Defaults to
   * the bundled generic photo.
   */
  image?: ImageSource | null;
}

/**
 * Cinematic city header: photo under a navy scrim, municipality emblem, greeting, city chip and
 * updates bell, the headline and the main call to action. Extends under the status bar.
 */
export function HeroBanner({
  greeting,
  municipalityLabel,
  cityLabel,
  cityAccessibilityLabel,
  onCityPress,
  hasUnseenUpdates,
  onUpdatesPress,
  onReportPress,
  image,
}: HeroBannerProps) {
  const colors = useThemeColors();
  const { t, direction } = useI18n();
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const isRTL = direction === 'rtl';
  const compact = width < layout.compactWidth || fontScale > 1.3;
  const height = Math.max(Math.min(width * 0.82, 360), 300) + insets.top;

  return (
    <View
      style={[
        styles.hero,
        { minHeight: height, backgroundColor: colors.hero, paddingTop: insets.top + spacing.sm },
      ]}
    >
      <Image
        source={image ?? DEFAULT_HERO}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={200}
        accessible={false}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundImage: colors.heroScrim }]} />

      <View style={styles.topRow}>
        <View style={styles.identity}>
          <View
            style={[
              styles.emblem,
              { backgroundColor: colors.glass, borderColor: colors.glassBorder },
            ]}
            accessible={false}
          >
            <Ionicons name="business" size={20} color={colors.onImage} />
          </View>
          <View style={styles.greeting}>
            <Text
              variant="subheading"
              numberOfLines={1}
              style={{ color: colors.onImage, fontWeight: '700' }}
              accessibilityRole="header"
            >
              {greeting}
            </Text>
            <Text variant="caption" numberOfLines={1} style={{ color: colors.onImageMuted }}>
              {!compact && municipalityLabel ? municipalityLabel : t('citizen.home.tagline')}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={onCityPress}
          accessibilityRole="button"
          accessibilityLabel={cityAccessibilityLabel}
          hitSlop={6}
          style={({ pressed }) => [
            styles.chip,
            { backgroundColor: colors.glass, borderColor: colors.glassBorder },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="location-outline" size={16} color={colors.onImage} />
          <Text
            variant="label"
            numberOfLines={1}
            style={[styles.chipText, { color: colors.onImage, maxWidth: compact ? 84 : 128 }]}
          >
            {cityLabel}
          </Text>
          <Ionicons name="chevron-down" size={14} color={colors.onImageMuted} />
        </Pressable>
        <IconButton
          variant="glass"
          icon="notifications-outline"
          dot={hasUnseenUpdates}
          accessibilityLabel={
            hasUnseenUpdates ? t('citizen.home.updatesNew') : t('citizen.home.updates')
          }
          onPress={onUpdatesPress}
        />
      </View>

      <View style={styles.body}>
        <Text variant="hero" style={{ color: colors.onImage }} accessibilityRole="header">
          {t('citizen.home.heroTitle')}
        </Text>
        <Text style={[styles.subtitle, { color: colors.onImageMuted }]}>
          {t('citizen.home.heroSubtitle')}
        </Text>
        <PressableCard
          onPress={onReportPress}
          accessibilityLabel={t('citizen.home.sendReport')}
          style={[styles.cta, { backgroundColor: colors.primary, shadowColor: '#000000' }]}
          pressedStyle={{ backgroundColor: colors.primaryPressed }}
        >
          <Ionicons name="paper-plane" size={20} color={colors.onPrimary} />
          <Text style={[styles.ctaText, { color: colors.onPrimary }]}>
            {t('citizen.home.sendReport')}
          </Text>
          <Ionicons name={forwardChevron(isRTL)} size={18} color={colors.onPrimary} />
        </PressableCard>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderBottomLeftRadius: radius.hero,
    borderBottomRightRadius: radius.hero,
    overflow: 'hidden',
    paddingHorizontal: layout.gutterWide,
    paddingBottom: spacing.xl,
    justifyContent: 'space-between',
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  identity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  emblem: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: { flex: 1 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: { fontWeight: '600' },
  pressed: { opacity: 0.75 },
  body: { gap: spacing.sm, marginTop: spacing.xl, maxWidth: 420 },
  subtitle: { fontSize: 16, lineHeight: 24 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    minHeight: 52,
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.full,
    ...shadow.raised,
    shadowOpacity: 0.3,
  },
  ctaText: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
});
