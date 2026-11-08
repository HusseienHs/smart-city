import Ionicons from '@expo/vector-icons/Ionicons';
import { radii, spacing } from '@smart-city/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { BackHandler, Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { StepScreen } from '@/components/report/step-screen';
import { Text } from '@/components/text';
import { useThemeColors } from '@/hooks/use-theme';
import { useI18n } from '@/lib/i18n';

function finish() {
  router.dismissTo('/');
}

/** Confirmation with the real tracking number. Back leaves the flow instead of reopening it. */
export default function SuccessScreen() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const { trackingNumber = '', photos = '0' } = useLocalSearchParams<{
    trackingNumber?: string;
    photos?: string;
  }>();
  const attached = Number.parseInt(photos, 10) || 0;

  useEffect(() => {
    // Android's hardware back button; there is no equivalent on iOS, and none on the web.
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      finish();
      return true;
    });
    return () => subscription.remove();
  }, []);

  return (
    <StepScreen
      title={t('reportFlow.successTitle')}
      hint={t('reportFlow.successDescription')}
      footer={
        <>
          <Button title={t('reportFlow.done')} onPress={finish} />
          <Button
            title={t('reportFlow.viewMyReports')}
            variant="soft"
            onPress={() => router.dismissTo('/my-reports')}
          />
        </>
      }
    >
      <View style={styles.icon}>
        <Ionicons name="checkmark-circle" size={72} color={colors.primary} />
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text variant="caption" muted>
          {t('reportFlow.trackingNumberLabel')}
        </Text>
        <Text variant="heading" selectable style={styles.tracking}>
          {trackingNumber}
        </Text>
        {attached > 0 ? (
          <Text variant="caption" muted>
            {t('reportFlow.successPhotos', { count: attached })}
          </Text>
        ) : null}
      </View>
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  icon: { alignItems: 'center' },
  card: {
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  // Tracking numbers are Latin/digits: keep them left-to-right in Hebrew and Arabic too.
  tracking: { writingDirection: 'ltr', letterSpacing: 1 },
});
