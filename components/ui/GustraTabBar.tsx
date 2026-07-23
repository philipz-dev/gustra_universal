import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GustraColors } from '@/constants/Colors';
import { captionTextStyle, Surface, Theme } from '@/constants/Theme';
import { Haptics } from '@/services/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Visible main tabs only — hidden siblings (e.g. edit-criteria) stay out of the pill. */
const VISIBLE_TAB_NAMES = new Set(['(main)', 'map', 'passport', 'settings']);

const PRESS_SPRING = { damping: 18, stiffness: 260 };

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
        }) => ReactNode;
      };
    }
  >;
  const navigation = props.navigation as {
    emit: (event: object) => { defaultPrevented?: boolean };
    navigate: (name: string, params?: object) => void;
  };

  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const activeRouteName = state.routes[state.index]?.name;
  // Keep Settings highlighted while on its hidden sibling screens.
  const focusedTabName =
    activeRouteName === 'edit-criteria' ||
    activeRouteName === 'reviewer-photo' ||
    activeRouteName === 'backup-restore'
      ? 'settings'
      : activeRouteName;

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Hide while typing so the soft keyboard does not fight the floating pill
  // (same idea as React Navigation `tabBarHideOnKeyboard`).
  if (keyboardVisible) {
    return <View pointerEvents="none" style={styles.hidden} />;
  }

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

          return (
            <TabItem
              key={route.key}
              focused={focused}
              label={label}
              color={color}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              icon={options.tabBarIcon?.({
                focused,
                color,
                size: 22,
              })}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (event.defaultPrevented) return;

                if (focused) {
                  // Swift: re-select Reviews / My Gustra → pop stack to root.
                  if (route.name === '(main)') {
                    Haptics.light();
                    navigation.navigate('(main)', { screen: 'index' });
                  } else if (route.name === 'passport') {
                    Haptics.light();
                    navigation.navigate('passport');
                  } else {
                    Haptics.selectionChanged();
                  }
                  return;
                }

                Haptics.selectionChanged();
                navigation.navigate(route.name, route.params);
              }}
              onLongPress={() => {
                navigation.emit({
                  type: 'tabLongPress',
                  target: route.key,
                });
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

function TabItem({
  focused,
  label,
  color,
  accessibilityLabel,
  icon,
  onPress,
  onLongPress,
}: {
  focused: boolean;
  label: string;
  color: string;
  accessibilityLabel: string;
  icon: ReactNode;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={focused ? { selected: true } : {}}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => {
        scale.value = withSpring(0.94, PRESS_SPRING);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, PRESS_SPRING);
      }}
      style={[
        styles.item,
        focused && styles.itemFocused,
        animatedStyle,
      ]}>
      {icon}
      <Text style={[styles.label, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  hidden: {
    height: 0,
    width: 0,
    opacity: 0,
  },
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
    ...Surface.floating,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 26,
    minHeight: Theme.size.hitTarget,
  },
  itemFocused: {
    backgroundColor: GustraColors.bubble,
  },
  label: {
    ...captionTextStyle,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
});
