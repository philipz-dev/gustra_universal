import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'wine_vision_upload_notice_v1';

/** True after the user has seen the first-time upload warning. */
export async function hasSeenWineVisionUploadNotice(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw === '1';
}

export async function markWineVisionUploadNoticeSeen(): Promise<void> {
  await AsyncStorage.setItem(KEY, '1');
}
