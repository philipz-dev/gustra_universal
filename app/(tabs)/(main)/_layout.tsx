import { Platform } from 'react-native';
import { Stack } from 'expo-router';

import { GustraColors } from '@/constants/Colors';

export const unstable_settings = {
  initialRouteName: 'index',
};

/**
 * Reviews stack nested under tabs so the floating tab bar stays visible.
 * Headers are rendered inside each screen (headerShown: false) so they slide
 * with the page instead of swapping outside the transition.
 */
export default function ReviewsStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: GustraColors.cream },
        // Android `slide_from_right` pops the outgoing screen away; iOS-style keeps both sliding.
        animation: Platform.OS === 'android' ? 'ios_from_right' : 'default',
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="restaurant/[id]" />
      <Stack.Screen name="review/[id]" />
    </Stack>
  );
}
