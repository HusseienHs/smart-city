import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabBarButtonProps } from 'expo-router/tabs';
import { Pressable, StyleSheet, View } from 'react-native';

import { useThemeColors } from '@/hooks/use-theme';

/** Raised, high-contrast center tab button so "Report" is always one tap away. */
export function ReportTabButton({
  onPress,
  onLongPress,
  accessibilityLabel,
}: BottomTabBarButtonProps) {
  const colors = useThemeColors();
  return (
    <View style={styles.container}>
      {/* The ring in the tab bar color makes the button look cut into the bar. */}
      <View style={[styles.ring, { backgroundColor: colors.surface }]}>
        <Pressable
          onPress={onPress}
          onLongPress={onLongPress}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          hitSlop={8}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: pressed ? colors.primaryPressed : colors.primary,
              shadowColor: colors.primary,
            },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="add" size={30} color={colors.onPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

const SIZE = 58;
const RING = 5;

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  ring: {
    padding: RING,
    borderRadius: (SIZE + RING * 2) / 2,
    marginTop: -(SIZE / 2.4),
  },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  pressed: { transform: [{ scale: 0.95 }] },
});
