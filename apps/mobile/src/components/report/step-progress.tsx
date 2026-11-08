import { radii, spacing } from '@smart-city/shared';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { useThemeColors } from '@/hooks/use-theme';
import { useI18n } from '@/lib/i18n';
import { REPORT_STEPS, type ReportStep } from '@/lib/report-draft';

/** "Step 2 of 5" with a segmented bar; segments follow the reading direction (RTL/LTR). */
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
      accessibilityLabel={label}
      accessibilityValue={{ min: 1, max: total, now: current }}
    >
      <Text variant="caption" muted>
        {label}
      </Text>
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
  root: { gap: spacing.xs },
  bar: { flexDirection: 'row', gap: spacing.xs },
  segment: { flex: 1, height: 4, borderRadius: radii.full },
});
