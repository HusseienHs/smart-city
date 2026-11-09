import { typography } from '@smart-city/shared';
import { Text as RNText, StyleSheet, type TextProps as RNTextProps } from 'react-native';

import { useThemeColors } from '@/hooks/use-theme';

type Variant = keyof typeof typography;

export interface TextProps extends RNTextProps {
  variant?: Variant;
  muted?: boolean;
}

export function Text({ variant = 'body', muted = false, style, ...props }: TextProps) {
  const colors = useThemeColors();
  return (
    <RNText
      style={[
        styles.base,
        styles[variant],
        { color: muted ? colors.textMuted : colors.text },
        style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  // `writingDirection: 'auto'` lets Hebrew/Arabic and English mix correctly per paragraph.
  base: { writingDirection: 'auto', textAlign: 'auto' },
  ...typography,
  // Uppercase only affects Latin scripts; Hebrew and Arabic are unchanged.
  overline: { ...typography.overline, textTransform: 'uppercase' },
});
