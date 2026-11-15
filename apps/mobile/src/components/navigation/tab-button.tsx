import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabBarButtonProps } from 'expo-router/tabs';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import type { IconName } from '@/components/ui/icon';
import { useThemeColors } from '@/hooks/use-theme';
import { radius } from '@/theme/metrics';

interface TabButtonProps extends BottomTabBarButtonProps {
  label: string;
  icon: IconName;
  activeIcon: IconName;
  /** Shows a small "new" dot on the icon; `dotLabel` replaces the spoken label then. */
  dot?: boolean;
  dotLabel?: string;
}

/**
 * A bottom-tab item: icon above a label; the active tab sits on a soft teal pill.
 * Selection comes from the navigator (`aria-selected`).
 */
export function TabButton({
  label,
  icon,
  activeIcon,
  dot = false,
  dotLabel,
  onPress,
  onLongPress,
  testID,
  'aria-selected': selected,
}: TabButtonProps) {
  const colors = useThemeColors();
  const focused = Boolean(selected);
  const tint = focused ? colors.primary : colors.textMuted;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress ?? undefined}
      testID={testID}
      accessibilityRole={Platform.OS === 'ios' ? 'button' : 'tab'}
      accessibilityLabel={dot && dotLabel ? dotLabel : label}
      accessibilityState={{ selected: focused }}
      style={styles.item}
    >
      <View style={[styles.pill, focused && { backgroundColor: colors.tabActive }]}>
        <View>
          <Ionicons name={focused ? activeIcon : icon} size={23} color={tint} />
          {dot ? (
            <View
              style={[styles.dot, { backgroundColor: colors.badge, borderColor: colors.surface }]}
            />
          ) : null}
        </View>
        <Text
          variant="micro"
          numberOfLines={1}
          maxFontSizeMultiplier={1.3}
          style={{ color: tint, fontWeight: focused ? '700' : '500' }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pill: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minWidth: 64,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  dot: {
    position: 'absolute',
    top: -1,
    end: -3,
    width: 10,
    height: 10,
    borderRadius: radius.full,
    borderWidth: 2,
  },
});
