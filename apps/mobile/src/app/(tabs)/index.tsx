import { radii, spacing } from '@smart-city/shared';
import type { MessageKey } from '@smart-city/shared/i18n';
import { Image, type ImageSource } from 'expo-image';
import { router, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Text } from '@/components/text';
import { useThemeColors } from '@/hooks/use-theme';
import { useI18n } from '@/lib/i18n';

interface Favorite {
  label: MessageKey;
  image: ImageSource;
  href: Href;
}

// Photos: see assets/images/CREDITS.md.
const FAVORITES: readonly Favorite[] = [
  { label: 'home.cityMap', image: require('@/assets/images/home-map.jpg'), href: '/explore' },
  { label: 'home.events', image: require('@/assets/images/home-events.jpg'), href: '/events' },
  {
    label: 'home.myAccount',
    image: require('@/assets/images/home-account.jpg'),
    href: '/profile',
  },
];

export default function HomeScreen() {
  const { t } = useI18n();
  const colors = useThemeColors();

  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: colors.surface }]}>
      <ScrollView>
        <Text variant="title" accessibilityRole="header" style={styles.title}>
          {t('home.title')}
        </Text>

        <Image
          source={require('@/assets/images/home-hero.jpg')}
          style={styles.hero}
          contentFit="cover"
          accessible={false}
        />

        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={styles.actions}>
            <Button title={t('home.reportIssue')} onPress={() => router.push('/report')} />
            <Button
              title={t('home.myReports')}
              variant="soft"
              onPress={() => router.push('/my-reports')}
            />
          </View>

          <Text style={styles.sectionLabel}>{t('home.favorites')}</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.favorites}
        >
          {FAVORITES.map((favorite) => (
            <Pressable
              key={favorite.label}
              onPress={() => router.push(favorite.href)}
              accessibilityRole="button"
              accessibilityLabel={t(favorite.label)}
              style={({ pressed }) => [styles.favorite, pressed && styles.pressed]}
            >
              <Image
                source={favorite.image}
                style={[styles.tile, { backgroundColor: colors.primarySoft }]}
                contentFit="cover"
                accessible={false}
              />
              <Text style={styles.favoriteLabel}>{t(favorite.label)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </ScrollView>
    </SafeAreaView>
  );
}

const TILE_SIZE = 130;
const SHEET_RADIUS = radii.xl;

const styles = StyleSheet.create({
  root: { flex: 1 },
  title: {
    fontSize: 32,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  hero: { width: '100%', height: 220 },
  // The white sheet overlaps the bottom of the photo with rounded top corners.
  sheet: {
    marginTop: -SHEET_RADIUS,
    borderTopStartRadius: SHEET_RADIUS,
    borderTopEndRadius: SHEET_RADIUS,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    gap: spacing.xl,
  },
  actions: { gap: spacing.md },
  sectionLabel: { fontSize: 16 },
  favorites: {
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  favorite: { width: TILE_SIZE, gap: spacing.md, alignItems: 'center' },
  tile: { width: TILE_SIZE, height: TILE_SIZE, borderRadius: radii.lg },
  favoriteLabel: { fontSize: 16, textAlign: 'center' },
  pressed: { opacity: 0.7 },
});
