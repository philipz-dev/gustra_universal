import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/** Matches Swift `ReviewerProfile.maxNameLength`. */
export const REVIEWER_MAX_NAME_LENGTH = 20;

const NAME_KEY = 'reviewerProfileName';

function photoDir(): string {
  const root = FileSystem.documentDirectory;
  if (!root) throw new Error('Document directory unavailable');
  return `${root}Profile/`;
}

function photoPath(): string {
  return `${photoDir()}reviewer.jpg`;
}

export type ReviewerProfileSnapshot = {
  name: string;
  /** Base64 JPEG bytes, or null when no photo. */
  photoBase64: string | null;
};

type ReviewerProfileValue = {
  ready: boolean;
  name: string;
  hasName: boolean;
  trimmedName: string;
  hasPhoto: boolean;
  /** File URI with cache-busting query for Image refresh. */
  photoUri: string | null;
  photoRevision: number;
  updateName: (next: string) => void;
  setPhotoFromUri: (sourceUri: string) => Promise<void>;
  clearPhoto: () => Promise<void>;
  getBackupSnapshot: () => Promise<ReviewerProfileSnapshot>;
  applyBackupSnapshot: (snapshot: ReviewerProfileSnapshot) => Promise<void>;
};

const ReviewerProfileContext = createContext<ReviewerProfileValue | null>(null);

async function ensurePhotoDir() {
  const dir = photoDir();
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

export function ReviewerProfileProvider({ children }: { children: ReactNode }) {
  const [name, setName] = useState('');
  const [hasPhoto, setHasPhoto] = useState(false);
  const [photoRevision, setPhotoRevision] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const storedName = await AsyncStorage.getItem(NAME_KEY);
        let photoExists = false;
        try {
          photoExists = (await FileSystem.getInfoAsync(photoPath())).exists;
        } catch {
          photoExists = false;
        }
        if (cancelled) return;
        if (storedName) {
          setName(storedName.trim().slice(0, REVIEWER_MAX_NAME_LENGTH));
        }
        setHasPhoto(photoExists);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateName = useCallback((next: string) => {
    let trimmed = next.trim();
    if (trimmed.length > REVIEWER_MAX_NAME_LENGTH) {
      trimmed = trimmed.slice(0, REVIEWER_MAX_NAME_LENGTH);
    }
    setName(trimmed);
    if (!trimmed) {
      void AsyncStorage.removeItem(NAME_KEY);
    } else {
      void AsyncStorage.setItem(NAME_KEY, trimmed);
    }
  }, []);

  const setPhotoFromUri = useCallback(async (sourceUri: string) => {
    await ensurePhotoDir();
    const dest = photoPath();
    // Overwrite existing file if present.
    try {
      const existing = await FileSystem.getInfoAsync(dest);
      if (existing.exists) {
        await FileSystem.deleteAsync(dest, { idempotent: true });
      }
    } catch {
      // ignore
    }
    await FileSystem.copyAsync({ from: sourceUri, to: dest });
    setHasPhoto(true);
    setPhotoRevision((n) => n + 1);
  }, []);

  const clearPhoto = useCallback(async () => {
    try {
      const dest = photoPath();
      const info = await FileSystem.getInfoAsync(dest);
      if (info.exists) {
        await FileSystem.deleteAsync(dest, { idempotent: true });
      }
    } finally {
      setHasPhoto(false);
      setPhotoRevision((n) => n + 1);
    }
  }, []);

  const getBackupSnapshot = useCallback(async (): Promise<ReviewerProfileSnapshot> => {
    let photoBase64: string | null = null;
    try {
      const dest = photoPath();
      const info = await FileSystem.getInfoAsync(dest);
      if (info.exists) {
        photoBase64 = await FileSystem.readAsStringAsync(dest, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }
    } catch {
      photoBase64 = null;
    }
    return {
      name: name.trim().slice(0, REVIEWER_MAX_NAME_LENGTH),
      photoBase64,
    };
  }, [name]);

  const applyBackupSnapshot = useCallback(
    async (snapshot: ReviewerProfileSnapshot) => {
      const nextName = (snapshot.name ?? '')
        .trim()
        .slice(0, REVIEWER_MAX_NAME_LENGTH);
      setName(nextName);
      if (!nextName) {
        await AsyncStorage.removeItem(NAME_KEY);
      } else {
        await AsyncStorage.setItem(NAME_KEY, nextName);
      }

      if (snapshot.photoBase64) {
        await ensurePhotoDir();
        const dest = photoPath();
        try {
          const existing = await FileSystem.getInfoAsync(dest);
          if (existing.exists) {
            await FileSystem.deleteAsync(dest, { idempotent: true });
          }
        } catch {
          // ignore
        }
        await FileSystem.writeAsStringAsync(dest, snapshot.photoBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        setHasPhoto(true);
        setPhotoRevision((n) => n + 1);
      } else {
        await clearPhoto();
      }
    },
    [clearPhoto],
  );

  const trimmedName = name.trim();
  let photoUri: string | null = null;
  try {
    photoUri = hasPhoto ? `${photoPath()}?v=${photoRevision}` : null;
  } catch {
    photoUri = null;
  }

  const value = useMemo(
    () => ({
      ready,
      name,
      hasName: trimmedName.length > 0,
      trimmedName,
      hasPhoto,
      photoUri,
      photoRevision,
      updateName,
      setPhotoFromUri,
      clearPhoto,
      getBackupSnapshot,
      applyBackupSnapshot,
    }),
    [
      ready,
      name,
      trimmedName,
      hasPhoto,
      photoUri,
      photoRevision,
      updateName,
      setPhotoFromUri,
      clearPhoto,
      getBackupSnapshot,
      applyBackupSnapshot,
    ],
  );

  return (
    <ReviewerProfileContext.Provider value={value}>
      {children}
    </ReviewerProfileContext.Provider>
  );
}

export function useReviewerProfile(): ReviewerProfileValue {
  const ctx = useContext(ReviewerProfileContext);
  if (!ctx) {
    throw new Error(
      'useReviewerProfile must be used within ReviewerProfileProvider',
    );
  }
  return ctx;
}
