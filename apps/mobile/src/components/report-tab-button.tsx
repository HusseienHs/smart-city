import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabBarButtonProps } from 'expo-router/tabs';
import { Pressable, StyleSheet, View } from 'react-native';

import { useThemeColors } from '@/hooks/use-theme';
import { useMotion } from '@/theme';
import { radius, shadow } from '@/theme/metrics';

import { Text } from './text';

/**
 * Raised center tab button ("New report"): a teal disc cut into the tab bar, with its label
 * underneath, so reporting is always one tap away.
 */
export function ReportTabButton({
  onPress,
  onLongPress,
  accessibilityLabel,
  label,
}: BottomTabBarButtonProps & { label: string }) {
  const colors = useThemeColors();
  const { reduced, pressScale } = useMotion();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress ?? undefined}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={6}
      style={styles.container}
    >
      {({ pressed }) => (
        <>
          {/* The ring in the tab bar color makes the button look cut into the bar. */}
          <View style={[styles.ring, { backgroundColor: colors.surface }]}>
            <View
              style={[
                styles.button,
                {
                  backgroundColor: pressed ? colors.primaryPressed : colors.primary,
                  shadowColor: colors.primary,
                },
                pressed && !reduced && { transform: [{ scale: pressScale }] },
              ]}
            >
              <Ionicons name="paper-plane" size={26} color={colors.onPrimary} />
            </View>
          </View>
          <Text
            variant="micro"
            numberOfLines={1}
            maxFontSizeMultiplier={1.3}
            style={[styles.label, { color: colors.text }]}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const SIZE = 60;
const RING = 6;

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  ring: {
    padding: RING,
    borderRadius: radius.full,
    marginTop: -(SIZE / 2.2),
  },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.float,
    shadowOpacity: 0.35,
  },
  label: { fontWeight: '700', marginTop: -2 },
});
