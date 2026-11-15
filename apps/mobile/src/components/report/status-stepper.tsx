import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { useThemeColors } from '@/hooks/use-theme';
import type { TrackerStep } from '@/lib/home-dashboard';
import { useI18n } from '@/lib/i18n';
import { formatReportDate } from '@/lib/my-reports';
import { radius } from '@/theme/metrics';

/**
 * Horizontal report progress: Sent → In review → In progress → Resolved, in reading order.
 * Done stages show a check, the current one a ring; dates appear under reached stages.
 * Read as one sentence by screen readers.
 */
export function StatusStepper({
  steps,
  compact = false,
}: {
  steps: TrackerStep[];
  compact?: boolean;
}) {
  const { t, locale } = useI18n();
  const colors = useThemeColors();
  const current = steps.find((step) => step.state === 'current') ?? steps[steps.length - 1]!;

  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${t('citizen.tracker.stages')}: ${t(`citizen.tracker.${current.stage}`)}`}
      accessibilityValue={{ min: 1, max: steps.length, now: steps.indexOf(current) + 1 }}
    >
      {steps.map((step, index) => {
        const reached = step.state !== 'upcoming';
        const next = steps[index + 1];
        const lineDone = next !== undefined && next.state !== 'upcoming';
        return (
          <View key={step.stage} style={styles.step}>
            <View style={styles.track}>
              <View
                style={[
                  styles.line,
                  index === 0 && styles.hidden,
                  { backgroundColor: reached ? colors.primary : colors.border },
                ]}
              />
              <View
                style={[
                  styles.node,
                  step.state === 'done' && { backgroundColor: colors.primary },
                  step.state === 'current' && {
                    backgroundColor: colors.surface,
                    borderWidth: 3,
                    borderColor: colors.primary,
                  },
                  step.state === 'upcoming' && {
                    backgroundColor: colors.surfaceMuted,
                    borderWidth: 1,
                    borderColor: colors.borderStrong,
                  },
                ]}
              >
                {step.state === 'done' ? (
                  <Ionicons name="checkmark" size={14} color={colors.onPrimary} />
                ) : step.state === 'current' ? (
                  <View style={[styles.core, { backgroundColor: colors.primary }]} />
                ) : null}
              </View>
              <View
                style={[
                  styles.line,
                  index === steps.length - 1 && styles.hidden,
                  { backgroundColor: lineDone ? colors.primary : colors.border },
                ]}
              />
            </View>
            <Text
              variant="micro"
              numberOfLines={2}
              style={[
                styles.label,
                {
                  color: reached ? colors.text : colors.textMuted,
                  fontWeight: reached ? '600' : '500',
                },
              ]}
            >
              {t(`citizen.tracker.${step.stage}`)}
            </Text>
            {!compact && step.date ? (
              <Text variant="micro" muted numberOfLines={1} style={styles.label}>
                {formatReportDate(step.date, locale)}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const NODE = 24;

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  step: { flex: 1, alignItems: 'center', gap: 4 },
  track: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  line: { flex: 1, height: 2.5, borderRadius: radius.full },
  hidden: { opacity: 0 },
  node: {
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  core: { width: 8, height: 8, borderRadius: 4 },
  label: { textAlign: 'center' },
});
