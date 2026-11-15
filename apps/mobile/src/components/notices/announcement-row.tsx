import Ionicons from '@expo/vector-icons/Ionicons';
import type { PublishedAnnouncement } from '@smart-city/api';
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { forwardChevron } from '@/components/ui/icon';
import { PressableCard } from '@/components/ui/pressable-card';
import { useThemeColors } from '@/hooks/use-theme';
import { localizedName } from '@/lib/home-area';
import { useI18n } from '@/lib/i18n';
import { formatReportDate } from '@/lib/my-reports';
import { announcementSummary, noticeImageUrl } from '@/lib/notice-board';
import { radius, spacing } from '@/theme/metrics';

import { useSeverityColor } from './severity-badge';

const SEVERITY_ICONS = {
  emergency: 'warning',
  important: 'alert-circle',
  info: 'megaphone-outline',
} as const;

/** Compact announcement (Home news): thumbnail, title, one-line summary and date. */
export function AnnouncementRow({
  announcement,
  onPress,
  last = false,
}: {
  announcement: PublishedAnnouncement;
  onPress: () => void;
  last?: boolean;
}) {
  const { t, locale, direction } = useI18n();
  const colors = useThemeColors();
  const accent = useSeverityColor(announcement.severity);
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = imageFailed ? null : noticeImageUrl(announcement.image_path);
  const title = localizedName(announcement.title, locale);
  const date = announcement.published_at ? formatReportDate(announcement.published_at, locale) : '';

  return (
    <PressableCard
      onPress={onPress}
      accessibilityLabel={`${t(`notices.severity.${announcement.severity}`)}. ${title}. ${date}`}
      style={[
        styles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
      ]}
    >
      <View style={[styles.thumb, { backgroundColor: colors.surfaceMuted }]} accessible={false}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={150}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <Ionicons name={SEVERITY_ICONS[announcement.severity]} size={26} color={accent} />
        )}
      </View>
      <View style={styles.text}>
        <Text variant="label" numberOfLines={2}>
          {title}
        </Text>
        <Text variant="caption" muted numberOfLines={2}>
          {announcementSummary(localizedName(announcement.body, locale), 90)}
        </Text>
        {date ? (
          <View style={styles.date}>
            <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
            <Text variant="micro" muted>
              {date}
            </Text>
          </View>
        ) : null}
      </View>
      <Ionicons name={forwardChevron(direction === 'rtl')} size={16} color={colors.textMuted} />
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  thumb: {
    width: 92,
    height: 72,
    borderRadius: radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 3 },
  date: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
