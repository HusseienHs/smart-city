import Ionicons from '@expo/vector-icons/Ionicons';
import type { PublishedAnnouncement } from '@smart-city/api';
import { spacing } from '@smart-city/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { LoadError, LoadingState } from '@/components/load-state';
import { AnnouncementCard } from '@/components/notices/announcement-card';
import { FilterChips } from '@/components/notices/filter-chips';
import { SignInRequired } from '@/components/sign-in-required';
import { Text } from '@/components/text';
import { useThemeColors } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { localizedName } from '@/lib/home-area';
import { useI18n } from '@/lib/i18n';
import {
  countByFilter,
  filterAnnouncements,
  useNoticeBoard,
  type NoticeFilter,
} from '@/lib/notice-board';

/**
 * The Notice Board: official announcements of the citizen's home municipality (published,
 * unexpired, from a municipality that joined), newest first. Refreshes when the tab is shown
 * and on pull-to-refresh.
 */
export default function NoticeBoardScreen() {
  const { t, locale } = useI18n();
  const colors = useThemeColors();
  const { user } = useAuth();
  const board = useNoticeBoard(user?.id ?? null);
  const [filter, setFilter] = useState<NoticeFilter>('all');

  // Quietly reload when the tab comes back into view (e.g. after changing the home city). The
  // first focus is skipped: the initial load is already running, and a second request would
  // replace it.
  const { refresh } = board;
  const focusedBefore = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!focusedBefore.current) {
        focusedBefore.current = true;
        return;
      }
      if (user) refresh();
    }, [user, refresh]),
  );

  const ready = board.status === 'success' && board.data.kind === 'ready' ? board.data : null;
  const announcements = useMemo(
    () => (ready ? filterAnnouncements(ready.announcements, filter) : []),
    [ready, filter],
  );
  const cityName = ready ? localizedName(ready.city.name, locale) : '';

  const header = (
    <View style={styles.header}>
      <Text variant="title" accessibilityRole="header">
        {t('notices.title')}
      </Text>
      <Text muted>{t('notices.subtitle')}</Text>
      {ready ? (
        <View style={styles.city}>
          <Ionicons name="location-outline" size={16} color={colors.primary} />
          <Text variant="caption" style={{ color: colors.primary }}>
            {cityName}
          </Text>
        </View>
      ) : null}
      {ready && ready.announcements.length > 0 ? (
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
    if (board.status === 'loading') return <LoadingState />;
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
        data={announcements}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={header}
        ListEmptyComponent={emptyContent()}
        refreshing={false}
        onRefresh={user ? refresh : undefined}
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
  content: { padding: spacing.lg, gap: spacing.md },
  header: { gap: spacing.sm, marginBottom: spacing.sm },
  city: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  gap: { gap: spacing.md },
});
