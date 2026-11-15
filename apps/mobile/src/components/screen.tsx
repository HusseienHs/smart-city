import Ionicons from '@expo/vector-icons/Ionicons';
import { radii, spacing } from '@smart-city/shared';
import type { ComponentProps, PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useThemeColors } from '@/hooks/use-theme';

import { Text } from './text';

interface ScreenProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  /** Optional icon badge above the title (e.g. on sign-in and sign-up). */
  icon?: ComponentProps<typeof Ionicons>['name'];
}

/** Standard screen scaffold: safe area, large title, scrollable content. */
export function Screen({ title, subtitle, icon, children }: ScreenProps) {
  const colors = useThemeColors();
  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Keep taps working while the keyboard is open, and scroll focused inputs into view. */}
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <View style={styles.header}>
          {icon ? (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <Ionicons name={icon} size={28} color={colors.onPrimary} />
            </View>
          ) : null}
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
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  header: { gap: spacing.sm, marginBottom: spacing.sm },
  badge: {
    width: 56,
    height: 56,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
});
