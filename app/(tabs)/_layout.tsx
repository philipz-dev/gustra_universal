import { SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router';

import { GustraTabBar } from '@/components/ui/GustraTabBar';
import { HouseNavHeader } from '@/components/ui/HouseNavHeader';
import { GustraColors } from '@/constants/Colors';
import { useAppTranslation } from '@/hooks/useAppTranslation';

export default function TabLayout() {
  const { t } = useAppTranslation();

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
        name="(main)"
        options={{
          title: t('tabs.reviews'),
          tabBarLabel: t('tabs.reviews'),
          headerShown: false,
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
          title: t('tabs.map'),
          tabBarLabel: t('tabs.map'),
          headerShown: false,
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
          title: t('tabs.passport'),
          tabBarLabel: t('tabs.passport'),
          headerShown: false,
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
          title: t('tabs.settings'),
          tabBarLabel: t('tabs.settings'),
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
      {/* Hidden siblings so the floating tab bar stays visible. */}
      <Tabs.Screen
        name="edit-criteria"
        options={{
          href: null,
          title: t('tabs.editCriteria'),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="reviewer-photo"
        options={{
          href: null,
          title: t('tabs.profilePhoto'),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="backup-restore"
        options={{
          href: null,
          title: t('tabs.backupRestore'),
        }}
      />
    </Tabs>
  );
}
