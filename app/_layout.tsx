import 'react-native-gesture-handler';

import {
  SourceSerif4_400Regular,
} from '@expo-google-fonts/source-serif-4/400Regular';
import {
  SourceSerif4_400Regular_Italic,
} from '@expo-google-fonts/source-serif-4/400Regular_Italic';
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
import { DefaultTheme, Stack, ThemeProvider, useNavigationContainerRef } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { SwipeDismissOverlay } from '@/components/feed/SwipeDismissOverlay';
import { ReviewEmailSnapshotHost } from '@/components/share/ReviewEmailSnapshotHost';
import { CriteriaSetupGate } from '@/components/setup/CriteriaSetupGate';
import { GlobalKeyboardDismiss } from '@/components/ui/GlobalKeyboardDismiss';
import { HouseAlertHost } from '@/components/ui/HouseAlert';
import { HouseUndoSnackbarHost } from '@/components/ui/HouseUndoSnackbar';
import { GustraColors } from '@/constants/Colors';
import { CriteriaSettingsProvider } from '@/context/CriteriaSettings';
import { DemoLabelSettingsProvider } from '@/context/DemoLabelSettings';
import { FeedFilterProvider } from '@/context/FeedFilterContext';
import { GoogleApiTrackerProvider } from '@/context/GoogleApiTracker';
import { LanguageSettingsProvider } from '@/context/LanguageSettings';
import { PassportDisplaySettingsProvider } from '@/context/PassportDisplaySettings';
import { PhotoLibrarySettingsProvider } from '@/context/PhotoLibrarySettings';
import { PhotoQualitySettingsProvider } from '@/context/PhotoQualitySettings';
import { ReviewerProfileProvider } from '@/context/ReviewerProfile';
import { ReviewsStoreProvider } from '@/context/ReviewsStore';
import { ShareImportLaunchProvider } from '@/context/ShareImportLaunch';
import '@/i18n';
import {
  initSentry,
  Sentry,
  sentryNavigationIntegration,
} from '@/services/monitoring/sentry';
import { lockAppPortraitOrientation } from '@/services/orientation/photoViewerOrientation';

initSentry();

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

/**
 * Cream UI → dark 3-button icons.
 * Expo Kotlin (`NavigationBarModule`): style "dark" ⇒
 *   hasLightBackground=true ⇒ isAppearanceLightNavigationBars=true.
 * Plugin: style "dark" ⇒ windowLightNavigationBar=true.
 * Docs require enforceContrast=false or setStyle is ignored.
 */
function applyAndroidNavigationChrome() {
  if (Platform.OS !== 'android') return;
  // Skip when backgrounded — native setStyle/setHidden reject if the
  // activity is gone ("The current activity is no longer available").
  if (AppState.currentState !== 'active') return;
  try {
    // In this Expo version setStyle returns void (a fire-and-forget native
    // call), so no await/catch is possible here. Guarding with AppState
    // 'active' + try/catch is the best we can do; the previous setHidden
    // rejection came from the removed declarative <NavigationBar />.
    NavigationBar.setStyle('dark');
  } catch {
    // Native module may still throw synchronously on a dying activity.
  }
}

function RootLayout() {
  const navigationRef = useNavigationContainerRef();
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    SourceSerif4_400Regular,
    SourceSerif4_400Regular_Italic,
    SourceSerif4_500Medium,
    SourceSerif4_600SemiBold,
    SourceSerif4_700Bold,
    SourceSerif4_800ExtraBold,
  });

  useEffect(() => {
    if (navigationRef && sentryNavigationIntegration) {
      sentryNavigationIntegration.registerNavigationContainer(navigationRef);
    }
  }, [navigationRef]);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  useEffect(() => {
    const applyChrome = () => {
      void SystemUI.setBackgroundColorAsync(GustraColors.cream);
      applyAndroidNavigationChrome();
    };
    applyChrome();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') applyChrome();
    });
    // Info.plist allows all orientations so the photo viewer can rotate;
    // keep the rest of the app locked to portrait (Swift OrientationLock).
    void lockAppPortraitOrientation();
    return () => sub.remove();
  }, []);

  if (!loaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <LanguageSettingsProvider>
        <CriteriaSettingsProvider>
          <DemoLabelSettingsProvider>
          <PassportDisplaySettingsProvider>
            <PhotoQualitySettingsProvider>
              <PhotoLibrarySettingsProvider>
                <GoogleApiTrackerProvider>
                  <ReviewerProfileProvider>
                    <ReviewsStoreProvider>
                      <FeedFilterProvider>
                        <ShareImportLaunchProvider>
                          <ThemeProvider value={GustraNavigationTheme}>
                            <GlobalKeyboardDismiss>
                              <View style={styles.root}>
                                {/*
                                  Prefer imperative setStyle only. The declarative
                                  <NavigationBar /> unmount path calls setHidden via
                                  setImmediate and races activity teardown on Android.
                                */}
                                <StatusBar style="light" />
                                <Stack screenOptions={{ headerShown: false }}>
                                  <Stack.Screen name="(tabs)" />
                                  <Stack.Screen
                                    name="criteria-setup"
                                    options={{
                                      presentation: 'fullScreenModal',
                                      animation: 'fade',
                                      gestureEnabled: false,
                                    }}
                                  />
                                  <Stack.Screen
                                    name="share-import"
                                    options={{
                                      presentation: 'modal',
                                      animation: 'slide_from_bottom',
                                    }}
                                  />
                                </Stack>
                                <CriteriaSetupGate />
                                <SwipeDismissOverlay />
                                <ReviewEmailSnapshotHost />
                                <HouseAlertHost />
                                <HouseUndoSnackbarHost />
                              </View>
                            </GlobalKeyboardDismiss>
                          </ThemeProvider>
                        </ShareImportLaunchProvider>
                      </FeedFilterProvider>
                    </ReviewsStoreProvider>
                  </ReviewerProfileProvider>
                </GoogleApiTrackerProvider>
              </PhotoLibrarySettingsProvider>
            </PhotoQualitySettingsProvider>
          </PassportDisplaySettingsProvider>
          </DemoLabelSettingsProvider>
        </CriteriaSettingsProvider>
      </LanguageSettingsProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
