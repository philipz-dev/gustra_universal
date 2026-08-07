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

/**
 * The fixed 20 criteria (Gustra 2.0). Every review criterion maps onto one of
 * these; there are no user-created custom criteria anymore. English titles are
 * the storage fallbacks (backup/share round-trip).
 *
 * The first five keep their original ids so the Swift backup columns
 * (`FIXED_BACKUP_CRITERION_IDS`) and all historical reviews stay readable.
 * The legacy `wines` id is folded into `drinks` at load (see ratings.ts).
 */
export const STANDARD_CRITERIA = [
  { id: 'food', title: 'Food' },
  { id: 'drinks', title: 'Drinks' },
  { id: 'service', title: 'Service' },
  { id: 'setting', title: 'Atmosphere' },
  { id: 'valueForMoney', title: 'Value for Money' },
  { id: 'quality', title: 'Quality' },
  { id: 'freshness', title: 'Freshness' },
  { id: 'variety', title: 'Variety' },
  { id: 'portions', title: 'Portions' },
  { id: 'presentation', title: 'Presentation' },
  { id: 'comfort', title: 'Comfort' },
  { id: 'speed', title: 'Speed' },
  { id: 'expertise', title: 'Expertise' },
  { id: 'timing', title: 'Timing' },
  { id: 'hygiene', title: 'Hygiene' },
  { id: 'reception', title: 'Reception' },
  { id: 'familyFriendly', title: 'Family-friendly' },
  { id: 'dietary', title: 'Dietary' },
  { id: 'acoustics', title: 'Acoustics' },
  { id: 'accessibility', title: 'Accessibility' },
] as const;

/**
 * Criterion ids with dedicated backup/share columns (Swift schema).
 * Every other criterion round-trips via `customCriterionScoresJSON`.
 */
export const FIXED_BACKUP_CRITERION_IDS = [
  'food',
  'drinks',
  'service',
  'setting',
  'valueForMoney',
] as const;

/** Legacy criterion ids that must map onto the 20 (never orphaned). */
export const LEGACY_CRITERION_IDS = ['wines'] as const;

/** Legacy wine id folded into `drinks` (see ratings.ts migrateLegacyCriteria). */
export const LEGACY_WINES_CRITERION_ID = 'wines' as const;

/** Localized display title for a standard criterion id. */
export function standardCriterionDisplayTitle(id: string): string {
  switch (id) {
    case 'food':
      return i18n.t('criteria.food');
    case 'drinks':
      return i18n.t('criteria.drinks');
    case 'service':
      return i18n.t('criteria.service');
    case 'setting':
      return i18n.t('criteria.atmosphere');
    case 'valueForMoney':
      return i18n.t('criteria.valueForMoney');
    case 'quality':
      return i18n.t('criteria.quality');
    case 'freshness':
      return i18n.t('criteria.freshness');
    case 'variety':
      return i18n.t('criteria.variety');
    case 'portions':
      return i18n.t('criteria.portions');
    case 'presentation':
      return i18n.t('criteria.presentation');
    case 'comfort':
      return i18n.t('criteria.comfort');
    case 'speed':
      return i18n.t('criteria.speed');
    case 'expertise':
      return i18n.t('criteria.expertise');
    case 'timing':
      return i18n.t('criteria.timing');
    case 'hygiene':
      return i18n.t('criteria.hygiene');
    case 'reception':
      return i18n.t('criteria.reception');
    case 'familyFriendly':
      return i18n.t('criteria.familyFriendly');
    case 'dietary':
      return i18n.t('criteria.dietary');
    case 'acoustics':
      return i18n.t('criteria.acoustics');
    case 'accessibility':
      return i18n.t('criteria.accessibility');
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

/** First-start defaults: the five core criteria, rest off (users opt in). */
export const FIRST_START_ENABLED_STANDARD_IDS: readonly StandardCriterionId[] = [
  'food',
  'drinks',
  'service',
  'setting',
  'valueForMoney',
] as const;

/** "Quick" preset: three core criteria, fastest to fill in. */
export const QUICK_PRESET_STANDARD_IDS: readonly StandardCriterionId[] = [
  'food',
  'drinks',
  'service',
] as const;

/** "Essentials" preset: the five core criteria (≈ first-start defaults). */
export const ESSENTIALS_PRESET_STANDARD_IDS: readonly StandardCriterionId[] =
  FIRST_START_ENABLED_STANDARD_IDS;

/**
 * No criterion is required to complete a review anymore — any single rated
 * criterion finishes a draft (see `hasAnyRatedCriterion`). The list stays as
 * an empty, documented constant so callers keep working and historic data
 * round-trips untouched.
 */
export const MANDATORY_STANDARD_CRITERION_IDS: readonly StandardCriterionId[] =
  [] as const;

/**
 * Historic "full control" starting point (Food + Drinks preselected). Kept as
 * documentation: full control no longer resets criteria — it keeps whatever
 * selection is already loaded (first-start defaults for a new install, or the
 * user's own earlier choices), so the constant is not applied anymore.
 */
export const FULL_CONTROL_INITIAL_STANDARD_IDS: readonly StandardCriterionId[] = [
  'food',
  'drinks',
] as const;

export function isMandatoryStandardCriterion(id: string): boolean {
  return MANDATORY_STANDARD_CRITERION_IDS.some((mandatoryId) => mandatoryId === id);
}

/**
 * Map a legacy / custom criterion id (and its display name) onto one of the
 * 20 fixed criteria. Unknown ids fall back to `accessibility` (the designated
 * catch-all) so no historical rating is ever dropped.
 */
export function mapLegacyCriterionId(
  id: string,
  title?: string | null,
): StandardCriterionId {
  const key = id.trim().toLowerCase();
  if (STANDARD_CRITERIA.some((c) => c.id === key)) {
    return key as StandardCriterionId;
  }
  const name = (title ?? '').trim().toLowerCase();
  const matches = (values: string[]) =>
    values.some((v) => key === v || name.includes(v) || key.includes(v));
  if (key === LEGACY_WINES_CRITERION_ID || matches(['wijn', 'wine', 'vin'])) {
    return 'drinks';
  }
  if (
    matches([
      'smaak', 'taste', 'sabor', 'goût', 'gusto', 'geschmack', 'sapori',
      'kwaliteit', 'quality', 'calidad', 'qualité', 'qualità',
    ])
  ) {
    return 'quality';
  }
  if (matches(['vers', 'fresh', 'fresc', 'fraîch', 'frisch', 'fresco'])) {
    return 'freshness';
  }
  if (
    matches([
      'keuze', 'assortiment', 'variety', 'selectie', 'choix', 'variedad',
      'auswahl', 'scelta',
    ])
  ) {
    return 'variety';
  }
  if (matches(['portie', 'portion', 'porcion', 'ration'])) {
    return 'portions';
  }
  if (matches(['presentatie', 'presentation', 'presentaci', 'présentat'])) {
    return 'presentation';
  }
  if (matches(['comfort', 'confort', 'gemak'])) {
    return 'comfort';
  }
  if (matches(['snel', 'speed', 'vitesse', 'velocidad', 'geschwindigkeit', 'velocit'])) {
    return 'speed';
  }
  if (matches(['vakkennis', 'kennis', 'expertise', 'conocimiento', 'compétence', 'fachwissen', 'competenza'])) {
    return 'expertise';
  }
  if (matches(['timing', 'tempo', 'timing'])) {
    return 'timing';
  }
  if (matches(['hygi', 'hygiene', 'higiene', 'hygiène', 'sauberkeit', 'igiene'])) {
    return 'hygiene';
  }
  if (matches(['ontvangst', 'reception', 'recepción', 'accueil', 'empfang', 'accoglienza'])) {
    return 'reception';
  }
  if (
    matches([
      'kindvriendelijk', 'family', 'familie', 'niños', 'enfants', 'kinder',
      'famiglia', 'kinderfreundlich',
    ])
  ) {
    return 'familyFriendly';
  }
  if (
    matches([
      'dieet', 'allerg', 'veggie', 'vegan', 'vegetar', 'dietary', 'dieta',
      'régime', 'diète', 'veganismo', 'vegetari',
    ])
  ) {
    return 'dietary';
  }
  if (matches(['akoestiek', 'acoustic', 'acústica', 'acoustique', 'akustik', 'geluid', 'noise'])) {
    return 'acoustics';
  }
  return 'accessibility';
}

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

function validDisabledStandardIds(ids: readonly string[]): Set<string> {
  return new Set(
    ids.filter(
      (id) =>
        STANDARD_CRITERIA.some((criterion) => criterion.id === id) &&
        !isMandatoryStandardCriterion(id),
    ),
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

/**
 * A first-start setup choice. `ids` is the fixed criterion set to enable;
 * `null` means "Full control" — the user picks on the criteria screen.
 */
export type CriteriaSetupChoice = {
  /** Criterion ids to enable; `null` opens the full criteria screen. */
  ids: readonly StandardCriterionId[] | null;
  /** Whether the setup is finished immediately (Quick/Essentials). */
  completeSetup: boolean;
};

export const QUICK_SETUP_CHOICE: CriteriaSetupChoice = {
  ids: QUICK_PRESET_STANDARD_IDS,
  completeSetup: true,
};

export const ESSENTIALS_SETUP_CHOICE: CriteriaSetupChoice = {
  ids: ESSENTIALS_PRESET_STANDARD_IDS,
  completeSetup: true,
};

export const FULL_CONTROL_SETUP_CHOICE: CriteriaSetupChoice = {
  ids: null,
  completeSetup: false,
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
  /** Apply a first-start setup choice (preset or full-control reset). */
  applySetupChoice: (choice: CriteriaSetupChoice) => Promise<void>;
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
          nextDisabled = validDisabledStandardIds(parsed);
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
    (disabled: Set<string>) => {
      return STANDARD_CRITERIA.filter((c) => !disabled.has(c.id)).length;
    },
    [],
  );

  const isStandardEnabled = useCallback(
    (id: string) => !disabledStandardIds.has(id),
    [disabledStandardIds],
  );

  const setStandardEnabled = useCallback(
    (id: string, enabled: boolean) => {
      if (!enabled && isMandatoryStandardCriterion(id)) return;
      setDisabledStandardIds((prev) => {
        const next = new Set(prev);
        if (enabled) {
          next.delete(id);
        } else {
          if (totalEnabledCount(prev) <= 1) return prev;
          next.add(id);
        }
        persistDisabled(next);
        return next;
      });
    },
    [persistDisabled, totalEnabledCount],
  );

  const setCustomEnabled = useCallback(
    (id: string, enabled: boolean) => {
      setCustomCriteria((prev) => {
        const index = prev.findIndex((c) => c.id === id);
        if (index < 0) return prev;
        if (!enabled && totalEnabledCount(disabledStandardIds) <= 1) {
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

  const applySetupChoice = useCallback(
    async (choice: CriteriaSetupChoice) => {
      if (choice.ids) {
        const nextDisabled = new Set(
          STANDARD_CRITERIA.map((c) => c.id).filter(
            (id) => !choice.ids!.includes(id as StandardCriterionId),
          ),
        );
        setDisabledStandardIds(nextDisabled);
        persistDisabled(nextDisabled);
      }
      // Full control: keep whatever criteria are already selected (the
      // first-start defaults for a brand-new install, or the user's own
      // earlier choices for a returning user). The criteria screen opens on
      // that existing selection instead of resetting to a fixed preset.
      if (choice.completeSetup) {
        await AsyncStorage.setItem(SETUP_KEY, '1');
        setSetupCompleted(true);
      }
    },
    [persistDisabled],
  );

  const reopenCriteriaSetupForDev = useCallback(async () => {
    // Only reopen the setup flow — keep the current criteria selection so a
    // returning user sees their own choices on the full-control screen.
    await AsyncStorage.removeItem(SETUP_KEY);
    setSetupCompleted(false);
  }, []);

  const enabledCriteria = useMemo(() => {
    // Only the 20 fixed criteria are selectable. Custom criteria from old
    // backups/shares are preserved in the snapshot for round-trip but are no
    // longer offered in the UI (their historical ratings map onto the 20).
    return STANDARD_CRITERIA.filter(
      (c) => !disabledStandardIds.has(c.id),
    ).map((c) => ({
      id: c.id,
      title: standardCriterionDisplayTitle(c.id),
    }));
  }, [disabledStandardIds, i18nInstance.language]);

  const hasMinEnabledCriteria = useMemo(
    () => totalEnabledCount(disabledStandardIds) >= 1,
    [disabledStandardIds, totalEnabledCount],
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
      const validDisabled = validDisabledStandardIds(
        snapshot.disabledStandardIds ?? [],
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
      applySetupChoice,
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
      applySetupChoice,
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
