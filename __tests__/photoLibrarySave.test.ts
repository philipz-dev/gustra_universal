jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => store.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
      removeItem: jest.fn(async (key: string) => {
        store.delete(key);
      }),
      __clear: jest.fn(async () => {
        store.clear();
      }),
    },
  };
});

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  hydratePhotoLibrarySave,
  isPhotoLibrarySaveEnabled,
  setPhotoLibrarySaveEnabled,
  subscribePhotoLibrarySave,
} from '@/services/photos/PhotoLibrarySave';

const mockAsyncStorage = AsyncStorage as unknown as {
  __clear: () => Promise<void>;
};

beforeEach(async () => {
  await mockAsyncStorage.__clear();
  await hydratePhotoLibrarySave();
});

describe('PhotoLibrarySave — save review photos to device library', () => {
  it('defaults to enabled (ON) when no preference is stored', async () => {
    expect(await hydratePhotoLibrarySave()).toBe(true);
    expect(isPhotoLibrarySaveEnabled()).toBe(true);
  });

  it('persists a disabled preference and reads it back on next hydrate', async () => {
    await setPhotoLibrarySaveEnabled(false);
    expect(isPhotoLibrarySaveEnabled()).toBe(false);
    expect(await hydratePhotoLibrarySave()).toBe(false);
    expect(isPhotoLibrarySaveEnabled()).toBe(false);
  });

  it('honours an explicitly stored "true"', async () => {
    await setPhotoLibrarySaveEnabled(true);
    expect(await hydratePhotoLibrarySave()).toBe(true);
  });

  it('notifies subscribers when the preference changes', async () => {
    const seen: boolean[] = [];
    const unsubscribe = subscribePhotoLibrarySave((next) => seen.push(next));
    await setPhotoLibrarySaveEnabled(false);
    await setPhotoLibrarySaveEnabled(true);
    unsubscribe();
    expect(seen).toEqual([false, true]);
  });
});
