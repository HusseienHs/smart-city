import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { useThemeColors } from '@/hooks/use-theme';
import { radius, shadow } from '@/theme/metrics';

interface SegmentedProps<T extends string> {
  value: T;
  options: readonly { value: T; label: string; dot?: boolean }[];
  onChange: (value: T) => void;
  accessibilityLabel: string;
}

/** A two-to-four option switch (tabs inside a screen). Mirrors in RTL. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  accessibilityLabel,
}: SegmentedProps<T>) {
  const colors = useThemeColors();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[styles.track, { backgroundColor: colors.surfaceMuted }]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[
              styles.segment,
              selected && [
                styles.selected,
                { backgroundColor: colors.surface, shadowColor: colors.shadow },
              ],
            ]}
          >
            <Text
              variant="label"
              numberOfLines={1}
              style={{ color: selected ? colors.text : colors.textMuted }}
            >
              {option.label}
            </Text>
            {option.dot ? <View style={[styles.dot, { backgroundColor: colors.badge }]} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', padding: 4, borderRadius: radius.md, gap: 4 },
  segment: {
    flex: 1,
    minHeight: 40,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    paddingHorizontal: 8,
  },
  selected: { ...shadow.card, shadowOpacity: 0.08 },
  dot: { width: 7, height: 7, borderRadius: radius.full },
});
