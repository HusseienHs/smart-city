import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReportCategory } from '@smart-city/shared';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { CATEGORY_ICONS } from '@/components/report/category-icons';
import { StatusStepper } from '@/components/report/status-stepper';
import { Text } from '@/components/text';
import { forwardChevron } from '@/components/ui/icon';
import { PressableCard } from '@/components/ui/pressable-card';
import { useThemeColors } from '@/hooks/use-theme';
import type { TrackerStep } from '@/lib/home-dashboard';
import { useI18n } from '@/lib/i18n';
import { radius, shadow, spacing } from '@/theme/metrics';

interface ReportTrackerProps {
  trackingNumber: string;
  category: ReportCategory;
  address: string | null;
  steps: TrackerStep[];
  /** A signed URL of the report's own photo, when there is one. Never a stock photo. */
  photoUri?: string | null;
  onPress: () => void;
}

/** "Track your report": the latest open report with its progress stepper. */
export function ReportTracker({
  trackingNumber,
  category,
  address,
  steps,
  photoUri,
  onPress,
}: ReportTrackerProps) {
  const { t, direction } = useI18n();
  const colors = useThemeColors();
  const isRTL = direction === 'rtl';
  const categoryName = t(`reportCategory.${category}`);
  const current = steps.find((step) => step.state === 'current') ?? steps[steps.length - 1]!;

  return (
    <PressableCard
      onPress={onPress}
      accessibilityLabel={t('citizen.home.trackingA11y', {
        number: trackingNumber,
        category: categoryName,
        stage: t(`citizen.tracker.${current.stage}`),
      })}
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.shadow },
      ]}
    >
      {/* The report's photo (or its category) fades into the card at the reading end. */}
      <View style={[styles.media, { backgroundColor: colors.primarySoft }]} accessible={false}>
        {photoUri ? (
          <Image
            source={{ uri: photoUri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            // Signed URLs expire within minutes: memory only.
            cachePolicy="memory"
            transition={200}
          />
        ) : (
          <Ionicons
            name={CATEGORY_ICONS[category]}
            size={56}
            color={colors.primary}
            style={styles.mediaIcon}
          />
        )}
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundImage: isRTL ? colors.mediaFadeLtr : colors.mediaFadeRtl },
          ]}
        />
      </View>

      <View style={styles.body}>
        <View style={styles.header}>
          <Text
            variant="subheading"
            accessibilityRole="header"
            style={styles.flex}
            numberOfLines={1}
          >
            {t('citizen.home.trackingTitle')}
          </Text>
          <Ionicons name={forwardChevron(isRTL)} size={18} color={colors.textMuted} />
        </View>
        <View style={styles.meta}>
          <Text variant="caption" style={[styles.number, { color: colors.primary }]}>
            {trackingNumber}
          </Text>
          <Text variant="caption" muted numberOfLines={1} style={styles.flex}>
            {address ? `${categoryName} · ${address}` : categoryName}
          </Text>
        </View>
        <StatusStepper steps={steps} />
      </View>
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    ...shadow.card,
  },
  media: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    end: 0,
    width: '38%',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.9,
  },
  mediaIcon: { opacity: 0.35, marginStart: spacing.xl },
  body: { padding: spacing.lg, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: -spacing.sm },
  number: { fontWeight: '700', writingDirection: 'ltr' },
  flex: { flex: 1 },
});
