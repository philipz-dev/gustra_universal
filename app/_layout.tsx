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
import { MD3LightTheme, PaperProvider } from 'react-native-paper';
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
 * MD3 theme for react-native-paper components, mapped onto the Gustra house
 * style. Same tonal cream + forest-green palette as the rest of the app, so
 * M3 components (Switch, Card) read as native Gustra instead of stock Material.
 */
const GustraMD3Theme = {
  ...MD3LightTheme,
  roundness: 2,
  colors: {
    ...MD3LightTheme.colors,
    primary: GustraColors.forestGreen,
    onPrimary: '#FFFFFF',
    primaryContainer: 'rgba(36, 78, 57, 0.14)',
    onPrimaryContainer: '#1B3D2B',
    secondary: 'rgba(36, 78, 57, 0.75)',
    onSecondary: '#FFFFFF',
    secondaryContainer: 'rgba(36, 78, 57, 0.12)',
    onSecondaryContainer: '#1B3D2B',
    background: GustraColors.cream,
    onBackground: GustraColors.ink,
    surface: GustraColors.bubble,
    onSurface: GustraColors.ink,
    surfaceVariant: 'rgba(236, 227, 207, 0.7)',
    onSurfaceVariant: 'rgba(35, 32, 26, 0.72)',
    outline: 'rgba(35, 32, 26, 0.18)',
    outlineVariant: 'rgba(35, 32, 26, 0.12)',
    elevation: {
      level0: 'transparent',
      level1: 'rgba(236, 227, 207, 0.75)',
      level2: 'rgba(236, 227, 207, 0.9)',
      level3: GustraColors.bubble,
      // Surface interpolates over levels 0–5 (inputRange [0..5]); omitting
      // level4/level5 made the range contain undefined → Invariant Violation
      // "outputRange must contain color or value with numeric component"
      // on Android feed cards (REACT-NATIVE-Q). Extend the cream trap.
      level4: 'rgba(233, 221, 197, 0.95)',
      level5: 'rgba(230, 216, 189, 0.98)',
    },
    error: GustraColors.ratingAvoid,
    onError: '#FFFFFF',
  },
  fonts: {
    ...MD3LightTheme.fonts,
    bodyLarge: { ...MD3LightTheme.fonts.bodyLarge, fontFamily: undefined },
  },
} as const;

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
                              <PaperProvider theme={GustraMD3Theme}>
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
                              </PaperProvider>
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
