import Ionicons from '@expo/vector-icons/Ionicons';
import { spacing } from '@smart-city/shared';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { LoadError, LoadingState } from '@/components/load-state';
import { SeverityBadge, useSeverityColor } from '@/components/notices/severity-badge';
import { screenHeaderOptions } from '@/components/screen-header';
import { SignInRequired } from '@/components/sign-in-required';
import { Text } from '@/components/text';
import { useThemeColors } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { localizedName } from '@/lib/home-area';
import { useI18n } from '@/lib/i18n';
import { formatReportDate } from '@/lib/my-reports';
import { isHighlighted, noticeImageUrl, useAnnouncement } from '@/lib/notice-board';

/**
 * One announcement in full: image, severity, title, publication and expiry dates, municipality,
 * neighborhood note and the whole text (selectable, so citizens can copy details).
 */
export default function AnnouncementScreen() {
  const { t, locale } = useI18n();
  const colors = useThemeColors();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const details = useAnnouncement(user?.id ?? null, id);
  const [imageFailed, setImageFailed] = useState(false);
  const loaded = details.status === 'success' ? details.data : null;
  const accent = useSeverityColor(loaded?.announcement.severity ?? 'info');
  const header = <Stack.Screen options={screenHeaderOptions(colors, t('notices.detailsTitle'))} />;

  if (!user || !loaded) {
    return (
      <View style={styles.padded}>
        {header}
        {!user ? (
          <SignInRequired />
        ) : details.status === 'loading' ? (
          <LoadingState />
        ) : details.status === 'error' ? (
          <LoadError error={details.error} onRetry={details.reload} />
        ) : (
          <EmptyState icon="megaphone-outline" title={t('notices.notFound')} />
        )}
      </View>
    );
  }

  const { announcement, city } = loaded;
  const imageUrl = imageFailed ? null : noticeImageUrl(announcement.image_path);

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      {header}
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.image}
          contentFit="cover"
          accessible={false}
          onError={() => setImageFailed(true)}
        />
      ) : null}

      <View style={styles.padded}>
        {isHighlighted(announcement.severity) ? (
          <View style={[styles.highlight, { backgroundColor: accent }]} />
        ) : null}
        <SeverityBadge severity={announcement.severity} />
        <Text variant="heading" accessibilityRole="header" selectable>
          {localizedName(announcement.title, locale)}
        </Text>

        <View style={styles.meta}>
          {announcement.published_at ? (
            <View style={styles.inline}>
              <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
              <Text variant="caption" muted>
                {t('notices.publishedOn', {
                  date: formatReportDate(announcement.published_at, locale),
                })}
              </Text>
            </View>
          ) : null}
          {announcement.expires_at ? (
            <View style={styles.inline}>
              <Ionicons name="hourglass-outline" size={16} color={colors.textMuted} />
              <Text variant="caption" muted>
                {t('notices.validUntil', {
                  date: formatReportDate(announcement.expires_at, locale),
                })}
              </Text>
            </View>
          ) : null}
          <View style={styles.inline}>
            <Ionicons name="business-outline" size={16} color={colors.textMuted} />
            <Text variant="caption" muted>
              {localizedName(city.name, locale)}
            </Text>
          </View>
          {announcement.neighborhood_id ? (
            <View style={styles.inline}>
              <Ionicons name="location-outline" size={16} color={colors.primary} />
              <Text variant="caption" style={{ color: colors.primary }}>
                {t('notices.neighborhood')}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Text selectable style={styles.bodyText}>
          {localizedName(announcement.body, locale)}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl },
  padded: { padding: spacing.xl, gap: spacing.md },
  image: { width: '100%', aspectRatio: 16 / 9 },
  highlight: { height: 4, width: 48, borderRadius: 2 },
  meta: { gap: spacing.xs },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  divider: { height: StyleSheet.hairlineWidth },
  bodyText: { fontSize: 17, lineHeight: 26 },
});
