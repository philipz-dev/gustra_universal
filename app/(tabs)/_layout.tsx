import { SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router';

import { GustraTabBar } from '@/components/ui/GustraTabBar';
import { HouseNavHeader } from '@/components/ui/HouseNavHeader';
import { ReviewsHeader } from '@/components/ui/ReviewsHeader';
import { GustraColors } from '@/constants/Colors';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <GustraTabBar {...props} />}
      screenOptions={{
        tabBarActiveTintColor: GustraColors.forestGreen,
        tabBarInactiveTintColor: 'rgba(35, 32, 26, 0.45)',
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
        },
        headerShadowVisible: false,
        headerShown: true,
        header: ({ options }) => (
          <HouseNavHeader title={String(options.title ?? '')} />
        ),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Reviews',
          tabBarLabel: 'Reviews',
          header: () => <ReviewsHeader />,
          tabBarIcon: ({ color, size }) => (
            <SymbolView
              name={{
                ios: 'book.closed',
                android: 'menu_book',
                web: 'menu_book',
              }}
              tintColor={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'My map',
          tabBarLabel: 'My map',
          tabBarIcon: ({ color, size }) => (
            <SymbolView
              name={{
                ios: 'map.fill',
                android: 'map',
                web: 'map',
              }}
              tintColor={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="passport"
        options={{
          title: 'My Gustra',
          tabBarLabel: 'My Gustra',
          tabBarIcon: ({ color, size }) => (
            <SymbolView
              name={{
                ios: 'chart.bar.doc.horizontal',
                android: 'bar_chart',
                web: 'bar_chart',
              }}
              tintColor={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <SymbolView
              name={{
                ios: 'gearshape.fill',
                android: 'settings',
                web: 'settings',
              }}
              tintColor={color}
              size={size}
            />
          ),
        }}
      />
    </Tabs>
  );
}
