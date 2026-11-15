import Ionicons from '@expo/vector-icons/Ionicons';
import type { PublishedAnnouncement } from '@smart-city/api';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { LoadError } from '@/components/load-state';
import { AnnouncementCard } from '@/components/notices/announcement-card';
import { FilterChips } from '@/components/notices/filter-chips';
import { SignInRequired } from '@/components/sign-in-required';
import { Text } from '@/components/text';
import { Segmented } from '@/components/ui/segmented';
import { SkeletonCard } from '@/components/ui/skeleton';
import { useThemeColors } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { localizedName } from '@/lib/home-area';
import { useI18n } from '@/lib/i18n';
import { countByFilter, filterAnnouncements, type NoticeFilter } from '@/lib/notice-board';
import { useUpdates } from '@/lib/updates-context';
import { layout, radius, spacing } from '@/theme/metrics';

type Section = 'announcements' | 'notifications';

/**
 * Updates (route `notices`, kept for deep links): official announcements of the citizen's home
 * municipality (published, unexpired, from a municipality that joined), newest first, and a
 * placeholder for personal notifications until the backend delivers them. Opening it clears the
 * "new" dot; it refreshes when shown again and on pull-to-refresh.
 */
export default function UpdatesScreen() {
  const { t, locale } = useI18n();
  const colors = useThemeColors();
  const { user } = useAuth();
  const { board, markSeen } = useUpdates();
  const [filter, setFilter] = useState<NoticeFilter>('all');
  const [section, setSection] = useState<Section>('announcements');

  // Quietly reload when the tab comes back into view (e.g. after changing the home city). The
  // first focus is skipped: the initial load is already running.
  const { refresh } = board;
  const focusedBefore = useRef(false);
  useFocusEffect(
    useCallback(() => {
      markSeen();
      if (!focusedBefore.current) {
        focusedBefore.current = true;
        return;
      }
      if (user) refresh();
    }, [user, refresh, markSeen]),
  );

  const ready = board.status === 'success' && board.data.kind === 'ready' ? board.data : null;
  const announcements = useMemo(
    () => (ready ? filterAnnouncements(ready.announcements, filter) : []),
    [ready, filter],
  );
  const cityName = ready ? localizedName(ready.city.name, locale) : '';
  const showAnnouncements = section === 'announcements';

  const header = (
    <View style={styles.header}>
      <Text variant="title" accessibilityRole="header">
        {t('citizen.updates.title')}
      </Text>
      <Text muted>{t('citizen.updates.subtitle')}</Text>
      {ready ? (
        <View style={[styles.city, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="location" size={14} color={colors.primary} />
          <Text variant="caption" style={{ color: colors.primary, fontWeight: '600' }}>
            {cityName}
          </Text>
        </View>
      ) : null}
      <Segmented
        value={section}
        onChange={setSection}
        accessibilityLabel={t('citizen.updates.sections')}
        options={[
          { value: 'announcements', label: t('citizen.updates.announcements') },
          { value: 'notifications', label: t('citizen.updates.notifications') },
        ]}
      />
      {showAnnouncements && ready && ready.announcements.length > 0 ? (
        <FilterChips
          value={filter}
          counts={countByFilter(ready.announcements)}
          onChange={setFilter}
        />
      ) : null}
    </View>
  );

  function emptyContent() {
    if (!user) return <SignInRequired />;
    if (!showAnnouncements) {
      return (
        <EmptyState
          icon="notifications-outline"
          title={t('citizen.updates.notificationsEmptyTitle')}
          description={t('citizen.updates.notificationsEmptyDescription')}
        />
      );
    }
    if (board.status === 'loading') {
      return (
        <View style={styles.gap}>
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </View>
      );
    }
    if (board.status === 'error') return <LoadError error={board.error} onRetry={board.reload} />;
    const data = board.data;
    if (data.kind === 'no-home') {
      return (
        <View style={styles.gap}>
          <EmptyState
            icon="home-outline"
            title={t('notices.noHomeTitle')}
            description={t('notices.noHomeDescription')}
          />
          <Button
            title={t('notices.setHomeCity')}
            onPress={() => router.push('/account/details')}
          />
        </View>
      );
    }
    if (data.kind === 'not-joined') {
      return (
        <EmptyState
          icon="time-outline"
          title={t('notices.notJoinedTitle', {
            municipality: localizedName(data.city.name, locale),
          })}
          description={t('notices.notJoinedDescription')}
        />
      );
    }
    if (data.announcements.length === 0) {
      return (
        <EmptyState
          icon="megaphone-outline"
          title={t('notices.emptyTitle')}
          description={t('notices.emptyDescription', { municipality: cityName })}
        />
      );
    }
    return <EmptyState icon="filter-outline" title={t('notices.emptyFilter')} />;
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: colors.background }]}>
      <FlatList<PublishedAnnouncement>
        data={showAnnouncements ? announcements : []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={header}
        ListEmptyComponent={emptyContent()}
        refreshing={false}
        onRefresh={user && showAnnouncements ? refresh : undefined}
        renderItem={({ item }) => (
          <AnnouncementCard
            announcement={item}
            municipalityName={cityName}
            onPress={() => router.push({ pathname: '/notices/[id]', params: { id: item.id } })}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: layout.maxWidth,
    alignSelf: 'center',
    padding: layout.gutterWide,
    gap: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  header: { gap: spacing.sm, marginBottom: spacing.sm },
  city: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.full,
  },
  gap: { gap: spacing.md },
});
