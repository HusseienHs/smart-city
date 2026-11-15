import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReportCategory } from '@smart-city/shared';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { CATEGORY_ICONS } from '@/components/report/category-icons';
import { Text } from '@/components/text';
import { forwardChevron } from '@/components/ui/icon';
import { PressableCard } from '@/components/ui/pressable-card';
import { useThemeColors } from '@/hooks/use-theme';
import { useI18n } from '@/lib/i18n';
import { layout, radius, shadow, spacing } from '@/theme/metrics';

interface ServiceGridProps {
  categories: readonly ReportCategory[];
  onSelect: (category: ReportCategory) => void;
}

/**
 * Quick services: the municipality's first report categories as tiles (four across, 2×2 on small
 * screens or large text). Each one starts a report in that category.
 */
export function ServiceGrid({ categories, onSelect }: ServiceGridProps) {
  const { t, direction } = useI18n();
  const colors = useThemeColors();
  const { width, fontScale } = useWindowDimensions();
  const twoColumns = width < 380 || fontScale > 1.2;
  const chevron = forwardChevron(direction === 'rtl');

  return (
    <View style={styles.grid}>
      {categories.map((category) => {
        const name = t(`reportCategory.${category}`);
        const hint = t(`citizen.categoryHint.${category}`);
        return (
          <PressableCard
            key={category}
            onPress={() => onSelect(category)}
            accessibilityLabel={`${name}. ${hint}`}
            style={[
              styles.tile,
              twoColumns ? styles.half : styles.quarter,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                shadowColor: colors.shadow,
              },
            ]}
          >
            <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name={CATEGORY_ICONS[category]} size={26} color={colors.primary} />
            </View>
            <Text variant="label" numberOfLines={2} style={styles.center}>
              {name}
            </Text>
            <Text variant="micro" muted numberOfLines={2} style={styles.center}>
              {hint}
            </Text>
            <View style={[styles.footer, { backgroundImage: footerGradient(colors.primarySoft) }]}>
              <View
                style={[styles.go, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Ionicons name={chevron} size={14} color={colors.primary} />
              </View>
            </View>
          </PressableCard>
        );
      })}
    </View>
  );
}

/** A soft teal band at the bottom of the tile (stands in for the reference's landscape art). */
function footerGradient(tint: string): string {
  return `linear-gradient(180deg, rgba(0,0,0,0) 0%, ${tint} 100%)`;
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm + 2 },
  tile: {
    flexGrow: 1,
    alignItems: 'center',
    gap: 6,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    minHeight: layout.minTouch * 3,
    ...shadow.card,
  },
  quarter: { flexBasis: '22%' },
  half: { flexBasis: '46%' },
  icon: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  center: { textAlign: 'center' },
  footer: {
    alignSelf: 'stretch',
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  go: {
    width: 26,
    height: 26,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
