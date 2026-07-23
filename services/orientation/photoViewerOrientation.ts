import * as ScreenOrientation from 'expo-screen-orientation';
import { Platform } from 'react-native';

/** App default — portrait only (Swift `OrientationLock.setPortrait`). */
export async function lockAppPortraitOrientation(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.PORTRAIT_UP,
    );
  } catch {
    // Expo Go / unsupported platforms
  }
}

/** Photo viewer — allow landscape (Swift `OrientationLock.setAll`). */
export async function unlockPhotoViewerOrientation(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await ScreenOrientation.unlockAsync();
  } catch {
    // Expo Go / unsupported platforms
  }
}
