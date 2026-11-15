import { Tabs } from 'expo-router/tabs';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabButton } from '@/components/navigation/tab-button';
import { ReportTabButton } from '@/components/report-tab-button';
import { useThemeColors } from '@/hooks/use-theme';
import { useI18n } from '@/lib/i18n';
import { UpdatesProvider, useUpdates } from '@/lib/updates-context';
import { layout, radius, shadow } from '@/theme/metrics';

/**
 * Home · Explore · New report · Updates · Account. The bar mirrors in RTL (Home on the right).
 *
 * Route names stay stable for deep links: `notices` is shown as "Updates", `profile` as
 * "Account"; `events` is kept (hidden) and forwards to Updates.
 */
function TabsNavigator() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { hasUnseen } = useUpdates();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          height: layout.tabBarHeight + insets.bottom + 8,
          paddingTop: 6,
          shadowColor: colors.shadow,
          ...shadow.raised,
          shadowOffset: { width: 0, height: -6 },
          shadowOpacity: 0.08,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('citizen.nav.home'),
          tabBarButton: (props) => (
            <TabButton
              {...props}
              label={t('citizen.nav.home')}
              icon="home-outline"
              activeIcon="home"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: t('citizen.nav.explore'),
          tabBarButton: (props) => (
            <TabButton
              {...props}
              label={t('citizen.nav.explore')}
              icon="map-outline"
              activeIcon="map"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="report"
        options={{
          title: t('citizen.nav.newReport'),
          tabBarButton: (props) => (
            <ReportTabButton {...props} label={t('citizen.nav.newReport')} />
          ),
        }}
      />
      <Tabs.Screen
        name="notices"
        options={{
          title: t('citizen.nav.updates'),
          tabBarButton: (props) => (
            <TabButton
              {...props}
              label={t('citizen.nav.updates')}
              icon="notifications-outline"
              activeIcon="notifications"
              dot={hasUnseen}
              dotLabel={t('citizen.home.updatesNew')}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('citizen.nav.account'),
          tabBarButton: (props) => (
            <TabButton
              {...props}
              label={t('citizen.nav.account')}
              icon="person-outline"
              activeIcon="person"
            />
          ),
        }}
      />
      <Tabs.Screen name="events" options={{ href: null }} />
    </Tabs>
  );
}

export default function TabsLayout() {
  return (
    <UpdatesProvider>
      <TabsNavigator />
    </UpdatesProvider>
  );
}
