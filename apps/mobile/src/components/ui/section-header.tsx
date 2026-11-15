import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { useThemeColors } from '@/hooks/use-theme';
import { useI18n } from '@/lib/i18n';
import { spacing } from '@/theme/metrics';

import { forwardChevron, type IconName } from './icon';

interface SectionHeaderProps {
  title: string;
  icon?: IconName;
  /** A trailing link such as "View all". */
  action?: { label: string; onPress: () => void; accessibilityLabel?: string };
}

/** A dashboard section title with an optional icon and a "View all" style link. */
export function SectionHeader({ title, icon, action }: SectionHeaderProps) {
  const colors = useThemeColors();
  const { direction } = useI18n();
  return (
    <View style={styles.row}>
      <View style={styles.title}>
        {icon ? <Ionicons name={icon} size={20} color={colors.primary} /> : null}
        <Text variant="subheading" accessibilityRole="header" style={styles.flex} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {action ? (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="link"
          accessibilityLabel={action.accessibilityLabel ?? action.label}
          hitSlop={10}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Text variant="label" style={{ color: colors.primary }}>
            {action.label}
          </Text>
          <Ionicons name={forwardChevron(direction === 'rtl')} size={16} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flexShrink: 1 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 32 },
  pressed: { opacity: 0.6 },
});
