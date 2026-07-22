import 'react-native-gesture-handler';

import {
  SourceSerif4_400Regular,
} from '@expo-google-fonts/source-serif-4/400Regular';
import {
  SourceSerif4_500Medium,
} from '@expo-google-fonts/source-serif-4/500Medium';
import {
  SourceSerif4_600SemiBold,
} from '@expo-google-fonts/source-serif-4/600SemiBold';
import {
  SourceSerif4_700Bold,
} from '@expo-google-fonts/source-serif-4/700Bold';
import {
  SourceSerif4_800ExtraBold,
} from '@expo-google-fonts/source-serif-4/800ExtraBold';
import { useFonts } from 'expo-font';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { SwipeDismissOverlay } from '@/components/feed/SwipeDismissOverlay';
import { GustraColors } from '@/constants/Colors';
import { CriteriaSettingsProvider } from '@/context/CriteriaSettings';
import { GoogleApiTrackerProvider } from '@/context/GoogleApiTracker';
import { PassportDisplaySettingsProvider } from '@/context/PassportDisplaySettings';
import { PhotoQualitySettingsProvider } from '@/context/PhotoQualitySettings';
import { ReviewerProfileProvider } from '@/context/ReviewerProfile';
import { ReviewsStoreProvider } from '@/context/ReviewsStore';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

const GustraNavigationTheme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    primary: GustraColors.forestGreen,
    background: GustraColors.cream,
    card: GustraColors.forestGreen,
    text: '#FFFFFF',
    border: 'rgba(35, 32, 26, 0.08)',
    notification: GustraColors.gold,
  },
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    SourceSerif4_400Regular,
    SourceSerif4_500Medium,
    SourceSerif4_600SemiBold,
    SourceSerif4_700Bold,
    SourceSerif4_800ExtraBold,
  });


  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <CriteriaSettingsProvider>
        <PassportDisplaySettingsProvider>
          <PhotoQualitySettingsProvider>
            <GoogleApiTrackerProvider>
              <ReviewerProfileProvider>
                <ReviewsStoreProvider>
                  <ThemeProvider value={GustraNavigationTheme}>
                    <View style={styles.root}>
                      <StatusBar style="light" />
                      <Stack screenOptions={{ headerShown: false }}>
                        <Stack.Screen name="(tabs)" />
                      </Stack>
                      <SwipeDismissOverlay />
                    </View>
                  </ThemeProvider>
                </ReviewsStoreProvider>
              </ReviewerProfileProvider>
            </GoogleApiTrackerProvider>
          </PhotoQualitySettingsProvider>
        </PassportDisplaySettingsProvider>
      </CriteriaSettingsProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});


