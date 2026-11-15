import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { useThemeColors } from '@/hooks/use-theme';
import { useI18n } from '@/lib/i18n';
import { REPORT_STEPS, type ReportStep } from '@/lib/report-draft';
import { radius, spacing } from '@/theme/metrics';

/** The step name, a "2 of 5" pill and a segmented bar; segments follow the reading direction. */
export function StepProgress({ step }: { step: ReportStep }) {
  const { t } = useI18n();
  const colors = useThemeColors();
  const current = REPORT_STEPS.indexOf(step) + 1;
  const total = REPORT_STEPS.length;
  const label = t('reportFlow.stepCounter', { current, total });

  return (
    <View
      style={styles.root}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${t(`reportFlow.steps.${step}`)}, ${label}`}
      accessibilityValue={{ min: 1, max: total, now: current }}
    >
      <View style={styles.labels}>
        <Text variant="label" style={{ color: colors.primary }}>
          {t(`reportFlow.steps.${step}`)}
        </Text>
        <View style={[styles.counter, { backgroundColor: colors.primarySoft }]}>
          <Text variant="micro" style={{ color: colors.primary, fontWeight: '700' }}>
            {label}
          </Text>
        </View>
      </View>
      <View style={styles.bar}>
        {REPORT_STEPS.map((name, index) => (
          <View
            key={name}
            style={[
              styles.segment,
              { backgroundColor: index < current ? colors.primary : colors.border },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  labels: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  counter: { paddingHorizontal: spacing.sm + 2, paddingVertical: 3, borderRadius: radius.full },
  bar: { flexDirection: 'row', gap: 6 },
  segment: { flex: 1, height: 6, borderRadius: radius.full },
});
