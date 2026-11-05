import { spacing } from '@smart-city/shared';
import { Stack } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { useThemeColors } from '@/hooks/use-theme';
import { useI18n } from '@/lib/i18n';

/** The citizen's own reports. Filled from `get_my_reports()` once report submission exists. */
export default function MyReportsScreen() {
  const { t } = useI18n();
  const colors = useThemeColors();

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('home.myReports') }} />
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
      >
        <EmptyState
          icon="document-text-outline"
          title={t('home.myReportsEmpty')}
          description={t('common.comingSoon')}
        />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg },
});
