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

/** Matches Swift `RatingCategory.standardCases`. */
export const STANDARD_CRITERIA = [
  { id: 'food', title: 'Food' },
  { id: 'drinks', title: 'Drinks' },
  { id: 'service', title: 'Service' },
  { id: 'setting', title: 'Atmosphere' },
  { id: 'valueForMoney', title: 'Value for Money' },
] as const;

export type StandardCriterionId = (typeof STANDARD_CRITERIA)[number]['id'];

export type CustomCriterionDefinition = {
  id: string;
  name: string;
  isEnabled: boolean;
};

export const CUSTOM_CRITERION_MAX_NAME_LENGTH = 20;

const DISABLED_KEY = 'disabledRatingCategories';
const CUSTOM_KEY = 'customCriteriaDefinitions';

export type CriteriaSettingsSnapshot = {
  disabledStandardIds: string[];
  customCriteria: CustomCriterionDefinition[];
};

type CriteriaSettingsValue = {
  ready: boolean;
  disabledStandardIds: Set<string>;
  customCriteria: CustomCriterionDefinition[];
  /** Enabled standard + custom criteria in display order. */
  enabledCriteria: { id: string; title: string }[];
  isStandardEnabled: (id: string) => boolean;
  setStandardEnabled: (id: string, enabled: boolean) => void;
  setCustomEnabled: (id: string, enabled: boolean) => void;
  addCustomCriterion: (name: string) => string | null;
  deleteCustomCriterion: (id: string) => void;
  getBackupSnapshot: () => CriteriaSettingsSnapshot;
  applyBackupSnapshot: (snapshot: CriteriaSettingsSnapshot) => Promise<void>;
};

const CriteriaSettingsContext = createContext<CriteriaSettingsValue | null>(null);

function newId(): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function CriteriaSettingsProvider({ children }: { children: ReactNode }) {
  const [disabledStandardIds, setDisabledStandardIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [customCriteria, setCustomCriteria] = useState<CustomCriterionDefinition[]>(
    [],
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [disabledRaw, customRaw] = await Promise.all([
          AsyncStorage.getItem(DISABLED_KEY),
          AsyncStorage.getItem(CUSTOM_KEY),
        ]);
        if (cancelled) return;

        if (disabledRaw) {
          const parsed = JSON.parse(disabledRaw) as string[];
          const valid = new Set(
            parsed.filter((id) =>
              STANDARD_CRITERIA.some((c) => c.id === id),
            ),
          );
          setDisabledStandardIds(valid);
        }

        if (customRaw) {
          const parsed = JSON.parse(customRaw) as CustomCriterionDefinition[];
          if (Array.isArray(parsed)) {
            setCustomCriteria(
              parsed.map((c) => ({
                id: c.id,
                name: String(c.name ?? '').slice(0, CUSTOM_CRITERION_MAX_NAME_LENGTH),
                isEnabled: Boolean(c.isEnabled),
              })),
            );
          }
        }
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

  const enabledCriteria = useMemo(() => {
    const standard = STANDARD_CRITERIA.filter(
      (c) => !disabledStandardIds.has(c.id),
    ).map((c) => ({ id: c.id, title: c.title }));
    const custom = customCriteria
      .filter((c) => c.isEnabled)
      .map((c) => ({ id: c.id, title: c.name }));
    return [...standard, ...custom];
  }, [customCriteria, disabledStandardIds]);

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
    },
    [persistCustom, persistDisabled],
  );

  const value = useMemo(
    () => ({
      ready,
      disabledStandardIds,
      customCriteria,
      enabledCriteria,
      isStandardEnabled,
      setStandardEnabled,
      setCustomEnabled,
      addCustomCriterion,
      deleteCustomCriterion,
      getBackupSnapshot,
      applyBackupSnapshot,
    }),
    [
      ready,
      disabledStandardIds,
      customCriteria,
      enabledCriteria,
      isStandardEnabled,
      setStandardEnabled,
      setCustomEnabled,
      addCustomCriterion,
      deleteCustomCriterion,
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
