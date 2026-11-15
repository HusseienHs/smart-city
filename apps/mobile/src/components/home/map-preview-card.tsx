import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { forwardChevron } from '@/components/ui/icon';
import { PressableCard } from '@/components/ui/pressable-card';
import { useThemeColors } from '@/hooks/use-theme';
import { useI18n } from '@/lib/i18n';
import { radius, shadow, spacing } from '@/theme/metrics';

/**
 * "City map" teaser that opens Explore. The artwork is a licensed, illustrative city plan
 * (assets/images/CREDITS.md), not data: the real reports are on the Explore map.
 */
export function MapPreviewCard({ onPress }: { onPress: () => void }) {
  const { t, direction } = useI18n();
  const colors = useThemeColors();
  const isRTL = direction === 'rtl';

  return (
    <PressableCard
      onPress={onPress}
      accessibilityLabel={`${t('citizen.home.mapTitle')}. ${t('citizen.home.mapSubtitle')}`}
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.shadow },
      ]}
    >
      <View style={styles.art} accessible={false}>
        <Image
          source={require('@/assets/images/home-map.jpg')}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundImage: isRTL ? colors.mediaFadeLtr : colors.mediaFadeRtl },
          ]}
        />
        <View
          style={[styles.pin, { backgroundColor: colors.primary, borderColor: colors.surface }]}
        >
          <Ionicons name="location" size={16} color={colors.onPrimary} />
        </View>
      </View>
      <View style={styles.body}>
        <View style={styles.title}>
          <Ionicons name="location-outline" size={20} color={colors.primary} />
          <Text variant="subheading" accessibilityRole="header">
            {t('citizen.home.mapTitle')}
          </Text>
        </View>
        <Text variant="caption" muted numberOfLines={2}>
          {t('citizen.home.mapSubtitle')}
        </Text>
        <View
          style={[
            styles.button,
            { borderColor: colors.primary, backgroundColor: colors.primarySoft },
          ]}
        >
          <Ionicons name="map-outline" size={16} color={colors.primary} />
          <Text variant="label" style={{ color: colors.primary }}>
            {t('citizen.home.mapOpen')}
          </Text>
          <Ionicons name={forwardChevron(isRTL)} size={14} color={colors.primary} />
        </View>
      </View>
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    minHeight: 150,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    ...shadow.card,
  },
  body: { flex: 1, padding: spacing.lg, gap: spacing.sm, justifyContent: 'center' },
  title: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  art: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    end: 0,
    width: '46%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pin: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    minHeight: 40,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
  },
});
