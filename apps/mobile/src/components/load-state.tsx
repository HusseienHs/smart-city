import { spacing } from '@smart-city/shared';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useThemeColors } from '@/hooks/use-theme';
import { apiErrorMessageKey } from '@/lib/api-error-message';
import { useI18n } from '@/lib/i18n';

import { Button } from './button';
import { Notice } from './report/notice';

/** Centered spinner while data loads. */
export function LoadingState() {
  const { t } = useI18n();
  const colors = useThemeColors();
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.primary} accessibilityLabel={t('common.loading')} />
    </View>
  );
}

/** A failed request: the translated reason and a retry. */
export function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <View style={styles.error}>
      <Notice tone="error" message={t(apiErrorMessageKey(error))} />
      <Button title={t('common.retry')} variant="soft" onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: spacing.xxl, alignItems: 'center' },
  error: { gap: spacing.md },
});
