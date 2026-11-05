import { spacing } from '@smart-city/shared';
import type { PropsWithChildren, ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { useThemeColors } from '@/hooks/use-theme';
import type { ReportStep } from '@/lib/report-draft';

import { StepProgress } from './step-progress';

interface StepScreenProps extends PropsWithChildren {
  step?: ReportStep;
  title: string;
  hint?: string;
  /** Actions pinned to the bottom of the screen (usually the Continue button). */
  footer?: ReactNode;
}

/**
 * Layout of one report step under the native header: progress, title, scrollable content and
 * a footer that stays above the home indicator.
 */
export function StepScreen({ step, title, hint, footer, children }: StepScreenProps) {
  const colors = useThemeColors();
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {step ? <StepProgress step={step} /> : null}
        <View style={styles.header}>
          <Text variant="heading" accessibilityRole="header">
            {title}
          </Text>
          {hint ? <Text muted>{hint}</Text> : null}
        </View>
        {children}
      </ScrollView>
      {footer ? (
        <SafeAreaView
          edges={['bottom']}
          style={[
            styles.footer,
            { backgroundColor: colors.surface, borderTopColor: colors.border },
          ]}
        >
          {footer}
        </SafeAreaView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.lg },
  header: { gap: spacing.xs },
  footer: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
