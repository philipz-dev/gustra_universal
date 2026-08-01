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
 * My Gustra stack so a Top-3 review pushes on top of the passport. Back
 * returns to My Gustra, not the Reviews feed.
 */
export default function PassportStackLayout() {
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
        <JsStack.Screen name="timemachine" />
        <JsStack.Screen name="restaurant/[id]" />
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
      <Stack.Screen name="timemachine" />
      <Stack.Screen name="restaurant/[id]" />
      <Stack.Screen name="review/[id]" />
    </Stack>
  );
}
