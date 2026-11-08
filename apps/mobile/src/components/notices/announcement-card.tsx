import Ionicons from '@expo/vector-icons/Ionicons';
import type { PublishedAnnouncement } from '@smart-city/api';
import { radii, spacing } from '@smart-city/shared';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { useThemeColors } from '@/hooks/use-theme';
import { localizedName } from '@/lib/home-area';
import { useI18n } from '@/lib/i18n';
import { formatReportDate } from '@/lib/my-reports';
import { announcementSummary, isHighlighted, noticeImageUrl } from '@/lib/notice-board';

import { SeverityBadge, useSeverityColor } from './severity-badge';

interface AnnouncementCardProps {
  announcement: PublishedAnnouncement;
  municipalityName: string;
  onPress: () => void;
}

/**
 * One announcement in the list: optional image, severity, date, title, a short description and
 * the municipality. Important and emergency notices get a colored edge on the reading-start side.
 */
export function AnnouncementCard({
  announcement,
  municipalityName,
  onPress,
}: AnnouncementCardProps) {
  const { t, locale } = useI18n();
  const colors = useThemeColors();
  const accent = useSeverityColor(announcement.severity);
  const highlighted = isHighlighted(announcement.severity);
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = imageFailed ? null : noticeImageUrl(announcement.image_path);
  const title = localizedName(announcement.title, locale);
  const date = announcement.published_at ? formatReportDate(announcement.published_at, locale) : '';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${t(`notices.severity.${announcement.severity}`)}. ${title}. ${date}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: highlighted ? accent : colors.border,
          borderStartColor: highlighted ? accent : colors.border,
          borderStartWidth: highlighted ? 4 : StyleSheet.hairlineWidth,
        },
        pressed && styles.pressed,
      ]}
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.image}
          contentFit="cover"
          accessible={false}
          onError={() => setImageFailed(true)}
        />
      ) : null}
      <View style={styles.body}>
        <View style={styles.meta}>
          <SeverityBadge severity={announcement.severity} />
          {date ? (
            <Text variant="caption" muted>
              {date}
            </Text>
          ) : null}
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <Text muted numberOfLines={3}>
          {announcementSummary(localizedName(announcement.body, locale))}
        </Text>
        <View style={styles.footer}>
          <Ionicons name="business-outline" size={14} color={colors.textMuted} />
          <Text variant="caption" muted style={styles.flex} numberOfLines={1}>
            {municipalityName}
          </Text>
          {announcement.neighborhood_id ? (
            <Text variant="caption" style={{ color: colors.primary }}>
              {t('notices.neighborhood')}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  image: { width: '100%', aspectRatio: 16 / 9 },
  body: { padding: spacing.lg, gap: spacing.sm },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: { fontSize: 17, lineHeight: 23, fontWeight: '700' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  flex: { flex: 1 },
  pressed: { opacity: 0.75 },
});
