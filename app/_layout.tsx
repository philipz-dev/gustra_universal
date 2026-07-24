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
import * as NavigationBar from 'expo-navigation-bar';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { SwipeDismissOverlay } from '@/components/feed/SwipeDismissOverlay';
import { ReviewEmailSnapshotHost } from '@/components/share/ReviewEmailSnapshotHost';
import { GlobalKeyboardDismiss } from '@/components/ui/GlobalKeyboardDismiss';
import { HouseAlertHost } from '@/components/ui/HouseAlert';
import { GustraColors } from '@/constants/Colors';
import { CriteriaSettingsProvider } from '@/context/CriteriaSettings';
import { FeedFilterProvider } from '@/context/FeedFilterContext';
import { GoogleApiTrackerProvider } from '@/context/GoogleApiTracker';
import { LanguageSettingsProvider } from '@/context/LanguageSettings';
import { PassportDisplaySettingsProvider } from '@/context/PassportDisplaySettings';
import { PhotoQualitySettingsProvider } from '@/context/PhotoQualitySettings';
import { ReviewerProfileProvider } from '@/context/ReviewerProfile';
import { ReviewsStoreProvider } from '@/context/ReviewsStore';
import { ShareImportLaunchProvider } from '@/context/ShareImportLaunch';
import '@/i18n';
import { lockAppPortraitOrientation } from '@/services/orientation/photoViewerOrientation';

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

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(GustraColors.cream);
    if (Platform.OS === 'android') {
      // SDK 57: `setStyle` — `light` = dark buttons on a light bar (cream UI).
      NavigationBar.setStyle('light');
    }
    // Info.plist allows all orientations so the photo viewer can rotate;
    // keep the rest of the app locked to portrait (Swift OrientationLock).
    void lockAppPortraitOrientation();
  }, []);

  if (!loaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <LanguageSettingsProvider>
        <CriteriaSettingsProvider>
          <PassportDisplaySettingsProvider>
            <PhotoQualitySettingsProvider>
              <GoogleApiTrackerProvider>
                <ReviewerProfileProvider>
                  <ReviewsStoreProvider>
                    <FeedFilterProvider>
                      <ShareImportLaunchProvider>
                        <ThemeProvider value={GustraNavigationTheme}>
                          <GlobalKeyboardDismiss>
                            <View style={styles.root}>
                              <StatusBar style="light" />
                              <Stack screenOptions={{ headerShown: false }}>
                                <Stack.Screen name="(tabs)" />
                                <Stack.Screen
                                  name="share-import"
                                  options={{
                                    presentation: 'modal',
                                    animation: 'slide_from_bottom',
                                  }}
                                />
                              </Stack>
                              <SwipeDismissOverlay />
                              <ReviewEmailSnapshotHost />
                              <HouseAlertHost />
                            </View>
                          </GlobalKeyboardDismiss>
                        </ThemeProvider>
                      </ShareImportLaunchProvider>
                    </FeedFilterProvider>
                  </ReviewsStoreProvider>
                </ReviewerProfileProvider>
              </GoogleApiTrackerProvider>
            </PhotoQualitySettingsProvider>
          </PassportDisplaySettingsProvider>
        </CriteriaSettingsProvider>
      </LanguageSettingsProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});


