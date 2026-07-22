import { Easing, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { Stack as JsStack } from 'expo-router/js-stack';

import { GustraColors } from '@/constants/Colors';

export const unstable_settings = {
  initialRouteName: 'index',
};

/** Same ease as filter sheet — UINavigationController-like, no spring bounce. */
const androidTiming = {
  animation: 'timing' as const,
  config: {
    duration: 320,
    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
  },
};

/**
 * Reviews stack nested under tabs so the floating tab bar stays visible.
 * Headers are rendered inside each screen (headerShown: false) so they slide
 * with the page instead of swapping outside the transition.
 *
 * Android uses the JS stack with timing (not spring) — native-stack pops
 * often read as a "springer" flash on back.
 *
 * Do not share a Fragment of Screen children across Stack / JsStack — expo-router
 * maps children by component identity and Fragments become Symbol type errors.
 */
export default function ReviewsStackLayout() {
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
        <JsStack.Screen name="add-review" />
        <JsStack.Screen name="nearby-restaurants" />
        <JsStack.Screen name="map-search" />
        <JsStack.Screen name="manual-entry" />
        <JsStack.Screen name="review-form" />
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
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="add-review" />
      <Stack.Screen name="nearby-restaurants" />
      <Stack.Screen name="map-search" />
      <Stack.Screen name="manual-entry" />
      <Stack.Screen name="review-form" />
      <Stack.Screen name="restaurant/[id]" />
      <Stack.Screen name="review/[id]" />
    </Stack>
  );
}
