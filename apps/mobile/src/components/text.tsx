import {
  Text as RNText,
  StyleSheet,
  type TextProps as RNTextProps,
  type TextStyle,
} from 'react-native';

import { useThemeColors } from '@/hooks/use-theme';
import { useFont } from '@/theme';
import { type, type TypeVariant } from '@/theme/typography';

export interface TextProps extends RNTextProps {
  variant?: TypeVariant;
  muted?: boolean;
}

/**
 * Text in the active language's Noto Sans face. The weight comes from the variant or the style
 * (`fontWeight`) and is mapped to the matching static font file.
 */
export function Text({ variant = 'body', muted = false, style, ...props }: TextProps) {
  const colors = useThemeColors();
  const font = useFont();
  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  const weight = flat.fontWeight ?? type[variant].fontWeight;

  return (
    <RNText
      style={[
        styles.base,
        styles[variant],
        { color: muted ? colors.textMuted : colors.text },
        style,
        font(weight),
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  // `writingDirection: 'auto'` lets Hebrew/Arabic and English mix correctly per paragraph.
  base: { writingDirection: 'auto', textAlign: 'auto' },
  ...type,
  // Uppercase only affects Latin scripts; Hebrew and Arabic are unchanged.
  overline: { ...type.overline, textTransform: 'uppercase' },
});
