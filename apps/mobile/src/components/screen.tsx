import { spacing } from '@smart-city/shared';
import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useThemeColors } from '@/hooks/use-theme';

import { Text } from './text';

interface ScreenProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
}

/** Standard screen scaffold: safe area, large title, scrollable content. */
export function Screen({ title, subtitle, children }: ScreenProps) {
  const colors = useThemeColors();
  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text variant="title" accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? <Text muted>{subtitle}</Text> : null}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.lg },
  header: { gap: spacing.xs, marginBottom: spacing.sm },
});
