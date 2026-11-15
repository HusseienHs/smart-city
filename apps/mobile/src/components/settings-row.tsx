import Ionicons from '@expo/vector-icons/Ionicons';
import { radii, spacing } from '@smart-city/shared';
import type { ComponentProps, PropsWithChildren, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { useThemeColors } from '@/hooks/use-theme';
import { useI18n } from '@/lib/i18n';

import { Text } from './text';

type IconName = ComponentProps<typeof Ionicons>['name'];

interface SettingsRowProps {
  label: string;
  icon: IconName;
  onPress?: () => void;
  /** Secondary text under the label (e.g. the current language). */
  detail?: string;
  /** Replaces the chevron with a spinner. */
  loading?: boolean;
  disabled?: boolean;
  /** Custom control instead of the chevron (e.g. a switch). */
  accessory?: ReactNode;
  /** `danger` colors the row red (e.g. sign out). */
  tone?: 'default' | 'danger';
  last?: boolean;
}

/**
 * A row of a settings list: a tinted icon tile at the start, label and detail, and a chevron
 * (or a custom accessory) at the end. Mirrors with the reading direction.
 */
export function SettingsRow({
  label,
  icon,
  onPress,
  detail,
  loading = false,
  disabled = false,
  accessory,
  tone = 'default',
  last = false,
}: SettingsRowProps) {
  const colors = useThemeColors();
  const { direction } = useI18n();
  const isDanger = tone === 'danger';
  const accent = isDanger ? colors.danger : colors.primary;

  const trailing =
    accessory ??
    (loading ? (
      <ActivityIndicator color={accent} />
    ) : onPress && !isDanger ? (
      <Ionicons
        name={direction === 'rtl' ? 'chevron-back' : 'chevron-forward'}
        size={18}
        color={colors.textMuted}
      />
    ) : null);

  const content = (
    <>
      <View
        style={[
          styles.iconTile,
          { backgroundColor: isDanger ? colors.dangerSoft : colors.primarySoft },
        ]}
      >
        <Ionicons name={icon} size={20} color={accent} />
      </View>
      <View style={styles.text}>
        <Text style={[styles.label, isDanger && { color: colors.danger }]}>{label}</Text>
        {detail ? (
          <Text variant="caption" muted numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
      {trailing}
    </>
  );
  const rowStyle = [
    styles.row,
    !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
  ];

  if (!onPress) {
    return (
      <View style={[rowStyle, disabled && styles.disabled]} accessible accessibilityLabel={label}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={({ pressed }) => [
        rowStyle,
        pressed && { backgroundColor: colors.surfaceMuted },
        disabled && styles.disabled,
      ]}
    >
      {content}
    </Pressable>
  );
}

/** A rounded card that holds a group of settings rows. */
export function SettingsGroup({ children }: PropsWithChildren) {
  const colors = useThemeColors();
  return (
    <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {children}
    </View>
  );
}

export function SectionHeader({ title }: { title: string }) {
  return (
    <Text variant="overline" muted style={styles.section} accessibilityRole="header">
      {title}
    </Text>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 60,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: radii.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 2 },
  label: { fontSize: 16, fontWeight: '500' },
  disabled: { opacity: 0.5 },
  group: {
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    // Clips the pressed highlight to the rounded corners (a shadow would be clipped too).
    overflow: 'hidden',
  },
  section: { marginTop: spacing.xl, marginBottom: spacing.sm, paddingHorizontal: spacing.xs },
});
