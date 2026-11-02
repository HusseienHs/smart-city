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
        ]}
      >
        <Ionicons name="add" size={32} color={colors.onPrimary} />
      </Pressable>
    </View>
  );
}

const SIZE = 60;

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    marginTop: -SIZE / 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
