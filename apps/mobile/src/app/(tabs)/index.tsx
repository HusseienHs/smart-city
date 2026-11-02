import { radii, spacing } from '@smart-city/shared';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useThemeColors } from '@/hooks/use-theme';
import { isSupabaseConfigured } from '@/lib/env';
import { useI18n } from '@/lib/i18n';

export default function HomeScreen() {
  const { t } = useI18n();
  const colors = useThemeColors();

  return (
    <Screen title={t('app.name')} subtitle={t('mobileScreens.homeSubtitle')}>
      <View
        style={[styles.status, { backgroundColor: colors.surfaceMuted }]}
        accessibilityRole="summary"
      >
        <View
          style={[
            styles.dot,
            { backgroundColor: isSupabaseConfigured ? colors.primary : colors.textMuted },
          ]}
        />
        <Text variant="caption" muted>
          {isSupabaseConfigured ? t('backend.connected') : t('backend.notConfigured')}
        </Text>
      </View>
      <EmptyState icon="newspaper-outline" title={t('mobileScreens.homeEmpty')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    alignSelf: 'flex-start',
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
