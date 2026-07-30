import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';

import { i18n } from '@/i18n';

/** Matches Swift `RatingCategory.standardCases` + Expo `wines`. English = storage fallbacks. */
export const STANDARD_CRITERIA = [
  { id: 'food', title: 'Food' },
  { id: 'drinks', title: 'Drinks' },
  { id: 'wines', title: 'Wines' },
  { id: 'service', title: 'Service' },
  { id: 'setting', title: 'Atmosphere' },
  { id: 'valueForMoney', title: 'Value for Money' },
] as const;

/**
 * Criterion ids with dedicated backup/share columns (Swift schema).
 * `wines` is additive and round-trips via `customCriterionScoresJSON`.
 */
export const FIXED_BACKUP_CRITERION_IDS = [
  'food',
  'drinks',
  'service',
  'setting',
  'valueForMoney',
] as const;

/** Localized display title for a standard criterion id. */
export function standardCriterionDisplayTitle(id: string): string {
  switch (id) {
    case 'food':
      return i18n.t('criteria.food');
    case 'drinks':
      return i18n.t('criteria.drinks');
    case 'wines':
      return i18n.t('criteria.wines');
    case 'service':
      return i18n.t('criteria.service');
    case 'setting':
      return i18n.t('criteria.atmosphere');
    case 'valueForMoney':
      return i18n.t('criteria.valueForMoney');
    default:
      return (
        STANDARD_CRITERIA.find((c) => c.id === id)?.title ?? id
      );
  }
}

/** English storage title for known standard ids (backup/share import). */
export function standardCriterionStorageTitle(id: string): string {
  return STANDARD_CRITERIA.find((c) => c.id === id)?.title ?? 'Custom';
}

export type StandardCriterionId = (typeof STANDARD_CRITERIA)[number]['id'];

export type CustomCriterionDefinition = {
  id: string;
  name: string;
  isEnabled: boolean;
};

export const CUSTOM_CRITERION_MAX_NAME_LENGTH = 20;

/** First-start defaults: Food + Wines on, other standards off. */
export const FIRST_START_ENABLED_STANDARD_IDS: readonly StandardCriterionId[] = [
  'food',
  'wines',
] as const;

const DISABLED_KEY = 'disabledRatingCategories';
const CUSTOM_KEY = 'customCriteriaDefinitions';
const SETUP_KEY = 'criteriaSetupCompleted';
const REVIEWS_STORE_V3 = 'gustraReviewsStore.v3';
const REVIEWS_STORE_V2 = 'gustraReviewsStore.v2';

export function firstStartDisabledStandardIds(): Set<string> {
  const enabled = new Set<string>(FIRST_START_ENABLED_STANDARD_IDS);
  return new Set(
    STANDARD_CRITERIA.map((c) => c.id).filter((id) => !enabled.has(id)),
  );
}

async function storageLooksLikeReturningUser(): Promise<boolean> {
  const [customRaw, reviewsV3, reviewsV2, reviewerName] = await Promise.all([
    AsyncStorage.getItem(CUSTOM_KEY),
    AsyncStorage.getItem(REVIEWS_STORE_V3),
    AsyncStorage.getItem(REVIEWS_STORE_V2),
    AsyncStorage.getItem('reviewerProfileName'),
  ]);
  // Do not use DISABLED_KEY alone — first-start writes it before setup is completed.
  if (customRaw != null) return true;
  if (reviewerName != null && reviewerName.trim().length > 0) return true;
  for (const raw of [reviewsV3, reviewsV2]) {
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as { reviews?: unknown[] };
      if (Array.isArray(parsed.reviews) && parsed.reviews.length > 0) {
        return true;
      }
    } catch {
      return true;
    }
  }
  return false;
}

export type CriteriaSettingsSnapshot = {
  disabledStandardIds: string[];
  customCriteria: CustomCriterionDefinition[];
};

type CriteriaSettingsValue = {
  ready: boolean;
  /** False until the first-start criteria setup is finished (or migrated). */
  setupCompleted: boolean;
  disabledStandardIds: Set<string>;
  customCriteria: CustomCriterionDefinition[];
  /** Enabled standard + custom criteria in display order. */
  enabledCriteria: { id: string; title: string }[];
  /** At least one standard or custom criterion is on. */
  hasMinEnabledCriteria: boolean;
  isStandardEnabled: (id: string) => boolean;
  setStandardEnabled: (id: string, enabled: boolean) => void;
  setCustomEnabled: (id: string, enabled: boolean) => void;
  addCustomCriterion: (name: string) => string | null;
  deleteCustomCriterion: (id: string) => void;
  completeCriteriaSetup: () => Promise<void>;
  /** Dev-only: reset to first-start defaults and show setup again. */
  reopenCriteriaSetupForDev: () => Promise<void>;
  getBackupSnapshot: () => CriteriaSettingsSnapshot;
  applyBackupSnapshot: (snapshot: CriteriaSettingsSnapshot) => Promise<void>;
};

const CriteriaSettingsContext = createContext<CriteriaSettingsValue | null>(null);

function newId(): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function CriteriaSettingsProvider({ children }: { children: ReactNode }) {
  const { i18n: i18nInstance } = useTranslation();
  const [disabledStandardIds, setDisabledStandardIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [customCriteria, setCustomCriteria] = useState<CustomCriterionDefinition[]>(
    [],
  );
  const [setupCompleted, setSetupCompleted] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [disabledRaw, customRaw, setupRaw] = await Promise.all([
          AsyncStorage.getItem(DISABLED_KEY),
          AsyncStorage.getItem(CUSTOM_KEY),
          AsyncStorage.getItem(SETUP_KEY),
        ]);
        if (cancelled) return;

        let nextDisabled = new Set<string>();
        if (disabledRaw) {
          const parsed = JSON.parse(disabledRaw) as string[];
          nextDisabled = new Set(
            parsed.filter((id) =>
              STANDARD_CRITERIA.some((c) => c.id === id),
            ),
          );
        }

        let nextCustom: CustomCriterionDefinition[] = [];
        if (customRaw) {
          const parsed = JSON.parse(customRaw) as CustomCriterionDefinition[];
          if (Array.isArray(parsed)) {
            nextCustom = parsed.map((c) => ({
              id: c.id,
              name: String(c.name ?? '').slice(0, CUSTOM_CRITERION_MAX_NAME_LENGTH),
              isEnabled: Boolean(c.isEnabled),
            }));
          }
        }

        let completed = setupRaw === '1';
        if (!completed) {
          if (await storageLooksLikeReturningUser()) {
            completed = true;
            await AsyncStorage.setItem(SETUP_KEY, '1');
          } else {
            nextDisabled = firstStartDisabledStandardIds();
            await AsyncStorage.setItem(
              DISABLED_KEY,
              JSON.stringify([...nextDisabled]),
            );
          }
        }

        if (cancelled) return;
        setDisabledStandardIds(nextDisabled);
        setCustomCriteria(nextCustom);
        setSetupCompleted(completed);
      } catch {
        // Keep defaults
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistDisabled = useCallback((next: Set<string>) => {
    void AsyncStorage.setItem(DISABLED_KEY, JSON.stringify([...next]));
  }, []);

  const persistCustom = useCallback((next: CustomCriterionDefinition[]) => {
    void AsyncStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
  }, []);

  const totalEnabledCount = useCallback(
    (disabled: Set<string>, customs: CustomCriterionDefinition[]) => {
      const standardEnabled = STANDARD_CRITERIA.filter(
        (c) => !disabled.has(c.id),
      ).length;
      const customEnabled = customs.filter((c) => c.isEnabled).length;
      return standardEnabled + customEnabled;
    },
    [],
  );

  const isStandardEnabled = useCallback(
    (id: string) => !disabledStandardIds.has(id),
    [disabledStandardIds],
  );

  const setStandardEnabled = useCallback(
    (id: string, enabled: boolean) => {
      setDisabledStandardIds((prev) => {
        const next = new Set(prev);
        if (enabled) {
          next.delete(id);
        } else {
          if (totalEnabledCount(prev, customCriteria) <= 1) return prev;
          next.add(id);
        }
        persistDisabled(next);
        return next;
      });
    },
    [customCriteria, persistDisabled, totalEnabledCount],
  );

  const setCustomEnabled = useCallback(
    (id: string, enabled: boolean) => {
      setCustomCriteria((prev) => {
        const index = prev.findIndex((c) => c.id === id);
        if (index < 0) return prev;
        if (!enabled && totalEnabledCount(disabledStandardIds, prev) <= 1) {
          return prev;
        }
        const next = [...prev];
        next[index] = { ...next[index], isEnabled: enabled };
        persistCustom(next);
        return next;
      });
    },
    [disabledStandardIds, persistCustom, totalEnabledCount],
  );

  const addCustomCriterion = useCallback(
    (name: string) => {
      let trimmed = name.trim();
      if (!trimmed) return null;
      if (trimmed.length > CUSTOM_CRITERION_MAX_NAME_LENGTH) {
        trimmed = trimmed.slice(0, CUSTOM_CRITERION_MAX_NAME_LENGTH);
      }
      const id = newId();
      setCustomCriteria((prev) => {
        const next = [...prev, { id, name: trimmed, isEnabled: true }];
        persistCustom(next);
        return next;
      });
      return id;
    },
    [persistCustom],
  );

  const deleteCustomCriterion = useCallback(
    (id: string) => {
      setCustomCriteria((prev) => {
        const next = prev.filter((c) => c.id !== id);
        persistCustom(next);
        return next;
      });
    },
    [persistCustom],
  );

  const completeCriteriaSetup = useCallback(async () => {
    await AsyncStorage.setItem(SETUP_KEY, '1');
    setSetupCompleted(true);
  }, []);

  const reopenCriteriaSetupForDev = useCallback(async () => {
    const nextDisabled = firstStartDisabledStandardIds();
    setDisabledStandardIds(nextDisabled);
    persistDisabled(nextDisabled);
    await AsyncStorage.removeItem(SETUP_KEY);
    setSetupCompleted(false);
  }, [persistDisabled]);

  const enabledCriteria = useMemo(() => {
    const standard = STANDARD_CRITERIA.filter(
      (c) => !disabledStandardIds.has(c.id),
    ).map((c) => ({
      id: c.id,
      title: standardCriterionDisplayTitle(c.id),
    }));
    const custom = customCriteria
      .filter((c) => c.isEnabled)
      .map((c) => ({ id: c.id, title: c.name }));
    return [...standard, ...custom];
  }, [customCriteria, disabledStandardIds, i18nInstance.language]);

  const hasMinEnabledCriteria = useMemo(
    () => totalEnabledCount(disabledStandardIds, customCriteria) >= 1,
    [customCriteria, disabledStandardIds, totalEnabledCount],
  );

  const getBackupSnapshot = useCallback(
    (): CriteriaSettingsSnapshot => ({
      disabledStandardIds: [...disabledStandardIds],
      customCriteria: customCriteria.map((c) => ({ ...c })),
    }),
    [customCriteria, disabledStandardIds],
  );

  const applyBackupSnapshot = useCallback(
    async (snapshot: CriteriaSettingsSnapshot) => {
      const validDisabled = new Set(
        (snapshot.disabledStandardIds ?? []).filter((id) =>
          STANDARD_CRITERIA.some((c) => c.id === id),
        ),
      );
      const nextCustom = (snapshot.customCriteria ?? []).map((c) => ({
        id: String(c.id),
        name: String(c.name ?? '').slice(0, CUSTOM_CRITERION_MAX_NAME_LENGTH),
        isEnabled: Boolean(c.isEnabled),
      }));
      setDisabledStandardIds(validDisabled);
      setCustomCriteria(nextCustom);
      persistDisabled(validDisabled);
      persistCustom(nextCustom);
      await AsyncStorage.setItem(SETUP_KEY, '1');
      setSetupCompleted(true);
    },
    [persistCustom, persistDisabled],
  );

  const value = useMemo(
    () => ({
      ready,
      setupCompleted,
      disabledStandardIds,
      customCriteria,
      enabledCriteria,
      hasMinEnabledCriteria,
      isStandardEnabled,
      setStandardEnabled,
      setCustomEnabled,
      addCustomCriterion,
      deleteCustomCriterion,
      completeCriteriaSetup,
      reopenCriteriaSetupForDev,
      getBackupSnapshot,
      applyBackupSnapshot,
    }),
    [
      ready,
      setupCompleted,
      disabledStandardIds,
      customCriteria,
      enabledCriteria,
      hasMinEnabledCriteria,
      isStandardEnabled,
      setStandardEnabled,
      setCustomEnabled,
      addCustomCriterion,
      deleteCustomCriterion,
      completeCriteriaSetup,
      reopenCriteriaSetupForDev,
      getBackupSnapshot,
      applyBackupSnapshot,
    ],
  );

  return (
    <CriteriaSettingsContext.Provider value={value}>
      {children}
    </CriteriaSettingsContext.Provider>
  );
}

export function useCriteriaSettings(): CriteriaSettingsValue {
  const ctx = useContext(CriteriaSettingsContext);
  if (!ctx) {
    throw new Error(
      'useCriteriaSettings must be used within CriteriaSettingsProvider',
    );
  }
  return ctx;
}
