import { Text as RNText, StyleSheet, type TextProps as RNTextProps } from 'react-native';

import { useThemeColors } from '@/hooks/use-theme';

type Variant = 'title' | 'heading' | 'body' | 'caption';

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
  title: { fontSize: 30, fontWeight: '700', letterSpacing: -0.5 },
  heading: { fontSize: 20, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22 },
  caption: { fontSize: 13, lineHeight: 18 },
});
