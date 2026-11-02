import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs, type BottomTabNavigationOptions } from 'expo-router/tabs';
import type { ComponentProps } from 'react';

import { ReportTabButton } from '@/components/report-tab-button';
import { useThemeColors } from '@/hooks/use-theme';
import { useI18n } from '@/lib/i18n';

type IconName = ComponentProps<typeof Ionicons>['name'];

type TabBarIcon = NonNullable<BottomTabNavigationOptions['tabBarIcon']>;

function TabIcon({ name, focused, size }: { name: IconName; focused: boolean; size: number }) {
  const colors = useThemeColors();
  return <Ionicons name={name} size={size} color={focused ? colors.primary : colors.textMuted} />;
}

function tabIcon(name: IconName, focusedName: IconName): TabBarIcon {
  return function renderTabIcon({ size, focused }) {
    return <TabIcon name={focused ? focusedName : name} focused={focused} size={size} />;
  };
}

export default function TabsLayout() {
  const { t } = useI18n();
  const colors = useThemeColors();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t('mobileTabs.home'), tabBarIcon: tabIcon('home-outline', 'home') }}
      />
      <Tabs.Screen
        name="explore"
        options={{ title: t('mobileTabs.explore'), tabBarIcon: tabIcon('map-outline', 'map') }}
      />
      <Tabs.Screen
        name="report"
        options={{
          title: t('mobileTabs.report'),
          tabBarAccessibilityLabel: t('mobileTabs.report'),
          tabBarButton: (props) => <ReportTabButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: t('mobileTabs.events'),
          tabBarIcon: tabIcon('calendar-outline', 'calendar'),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('mobileTabs.profile'),
          tabBarIcon: tabIcon('person-circle-outline', 'person-circle'),
        }}
      />
    </Tabs>
  );
}
