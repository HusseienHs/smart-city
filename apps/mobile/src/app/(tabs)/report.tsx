import { REPORT_CATEGORIES, radii, spacing } from '@smart-city/shared';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useThemeColors } from '@/hooks/use-theme';
import { useI18n } from '@/lib/i18n';

export default function ReportScreen() {
  const { t } = useI18n();
  const colors = useThemeColors();

  return (
    <Screen title={t('mobileTabs.report')} subtitle={t('mobileScreens.reportSubtitle')}>
      <EmptyState icon="megaphone-outline" title={t('mobileScreens.reportEmpty')} />
      {/* Category preview, rendered from the shared domain constants and translations. */}
      <View style={styles.grid}>
        {REPORT_CATEGORIES.map((category) => (
          <View
            key={category}
            style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text variant="caption">{t(`reportCategory.${category}`)}</Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
