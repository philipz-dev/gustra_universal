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
import 'react-native-reanimated';

import { HouseNavHeader } from '@/components/ui/HouseNavHeader';
import { GustraColors } from '@/constants/Colors';
import { Theme } from '@/constants/Theme';
import { CriteriaSettingsProvider } from '@/context/CriteriaSettings';
import { PassportDisplaySettingsProvider } from '@/context/PassportDisplaySettings';








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
    <CriteriaSettingsProvider>
      <PassportDisplaySettingsProvider>
        <ThemeProvider value={GustraNavigationTheme}>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShadowVisible: false,
              contentStyle: { backgroundColor: GustraColors.cream },
              header: ({ options, navigation, back }) => (
                <HouseNavHeader
                  title={String(options.title ?? '')}
                  titleSize={Theme.navigation.secondaryTitleSize}
                  showBack={back != null}
                  onBack={() => navigation.goBack()}
                />
              ),
            }}>

            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="restaurant/[id]"
              options={{ title: 'Visits', headerBackTitle: '' }}
            />
            <Stack.Screen
              name="review/[id]"
              options={{ title: 'Review', headerBackTitle: '' }}
            />
            <Stack.Screen
              name="settings/edit-criteria"
              options={{ title: 'Edit review criteria', headerBackTitle: '' }}
            />
          </Stack>
        </ThemeProvider>
      </PassportDisplaySettingsProvider>
    </CriteriaSettingsProvider>
  );
}

