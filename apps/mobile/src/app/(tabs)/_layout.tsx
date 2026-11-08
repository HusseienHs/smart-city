import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs, type BottomTabNavigationOptions } from 'expo-router/tabs';
import type { ComponentProps } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

/**
 * Room for the icon and a full line of label text. The default (49) left the label a 10 px box,
 * which cut off the bottom of the text. The bottom safe-area inset (gesture bar) is added on top.
 */
const TAB_BAR_HEIGHT = 60;

export default function TabsLayout() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: TAB_BAR_HEIGHT + insets.bottom,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, lineHeight: 15 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t('mobileTabs.home'), tabBarIcon: tabIcon('home-outline', 'home') }}
      />
      <Tabs.Screen
        name="notices"
        options={{
          title: t('mobileTabs.notices'),
          tabBarIcon: tabIcon('megaphone-outline', 'megaphone'),
        }}
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
