import Ionicons from '@expo/vector-icons/Ionicons';
import { radii, spacing } from '@smart-city/shared';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { useThemeColors } from '@/hooks/use-theme';

import { Text } from './text';

interface EmptyStateProps {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  description?: string;
}

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  const colors = useThemeColors();
  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessible
      accessibilityLabel={description ? `${title}. ${description}` : title}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={icon} size={30} color={colors.primary} />
      </View>
      <Text variant="subheading" style={styles.center}>
        {title}
      </Text>
      {description ? (
        <Text muted style={[styles.center, styles.description]}>
          {description}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  center: { textAlign: 'center' },
  description: { maxWidth: 300 },
});
