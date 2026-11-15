import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { useThemeColors } from '@/hooks/use-theme';
import { radius } from '@/theme/metrics';

import type { IconName } from './icon';
import { PressableCard } from './pressable-card';

interface IconButtonProps {
  icon: IconName;
  accessibilityLabel: string;
  onPress: () => void;
  /** `glass` sits on photos (translucent, white icon); `surface` on pages. */
  variant?: 'glass' | 'surface';
  /** A small dot (e.g. something new); the label should say so too. */
  dot?: boolean;
}

/** Round 44 pt icon button. */
export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  variant = 'surface',
  dot = false,
}: IconButtonProps) {
  const colors = useThemeColors();
  const glass = variant === 'glass';
  return (
    <PressableCard
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      style={[
        styles.button,
        glass
          ? { backgroundColor: colors.glass, borderColor: colors.glassBorder }
          : { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Ionicons name={icon} size={22} color={glass ? colors.onImage : colors.text} />
      {dot ? (
        <View
          style={[
            styles.dot,
            { backgroundColor: colors.badge, borderColor: glass ? colors.hero : colors.surface },
          ]}
        />
      ) : null}
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 9,
    end: 10,
    width: 10,
    height: 10,
    borderRadius: radius.full,
    borderWidth: 2,
  },
});
