import { Easing, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { Stack as JsStack } from 'expo-router/js-stack';

import { GustraColors } from '@/constants/Colors';

export const unstable_settings = {
  initialRouteName: 'index',
};

const androidTiming = {
  animation: 'timing' as const,
  config: {
    duration: 320,
    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
  },
};

/**
 * My map stack so pin → review pushes on top of the map (Swift
 * `NavigationStack` on MemoriesMapView). Back returns to My map, not Reviews.
 */
export default function MapStackLayout() {
  if (Platform.OS === 'android') {
    return (
      <JsStack
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: GustraColors.cream },
          detachPreviousScreen: false,
          gestureEnabled: true,
          transitionSpec: {
            open: androidTiming,
            close: androidTiming,
          },
        }}>
        <JsStack.Screen name="index" />
        <JsStack.Screen name="review/[id]" />
      </JsStack>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: GustraColors.cream },
        animation: 'default',
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
        animationDuration: 350,
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="review/[id]" />
    </Stack>
  );
}
