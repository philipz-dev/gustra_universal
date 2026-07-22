import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GustraColors } from '@/constants/Colors';
import { captionTextStyle } from '@/constants/Theme';

/** Visible main tabs only — hidden siblings (e.g. edit-criteria) stay out of the pill. */
const VISIBLE_TAB_NAMES = new Set(['(main)', 'map', 'passport', 'settings']);

/** Floating cream pill tab bar (visual match for iOS 26 Gustra TabView). */
export function GustraTabBar(props: Record<string, unknown>) {
  const state = props.state as {
    index: number;
    routes: { key: string; name: string; params?: object }[];
  };
  const descriptors = props.descriptors as Record<
    string,
    {
      options: {
        title?: string;
        href?: string | null;
        tabBarLabel?: unknown;
        tabBarAccessibilityLabel?: string;
        tabBarIcon?: (p: {
          focused: boolean;
          color: string;
          size: number;
        }) => React.ReactNode;
      };
    }
  >;
  const navigation = props.navigation as {
    emit: (event: object) => { defaultPrevented?: boolean };
    navigate: (name: string, params?: object) => void;
  };

  const insets = useSafeAreaInsets();
  const activeRouteName = state.routes[state.index]?.name;
  // Keep Settings highlighted while on its hidden sibling screens.
  const focusedTabName =
    activeRouteName === 'edit-criteria' ||
    activeRouteName === 'reviewer-photo' ||
    activeRouteName === 'backup-restore'
      ? 'settings'
      : activeRouteName;


  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.pill}>
        {state.routes.map((route) => {
          if (!VISIBLE_TAB_NAMES.has(route.name)) return null;

          const { options } = descriptors[route.key];
          if (options.href === null || !options.tabBarIcon) return null;

          const focused = route.name === focusedTabName;
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : typeof options.title === 'string'
                ? options.title
                : route.name;

          const color = focused
            ? GustraColors.forestGreen
            : 'rgba(35, 32, 26, 0.45)';

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              onPress={onPress}
              onLongPress={onLongPress}
              style={({ pressed }) => [
                styles.item,
                focused && styles.itemFocused,
                pressed && styles.itemPressed,
              ]}>
              {options.tabBarIcon?.({
                focused,
                color,
                size: 22,
              })}
              <Text style={[styles.label, { color }]} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          );
        })}

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: 18,
    backgroundColor: 'transparent',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 420,
    minHeight: 62,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 34,
    backgroundColor: GustraColors.cream,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(35, 32, 26, 0.08)',
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 26,
    minHeight: 50,
  },
  itemFocused: {
    backgroundColor: GustraColors.bubble,
  },
  itemPressed: {
    opacity: 0.85,
  },
  label: {
    ...captionTextStyle,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
});

