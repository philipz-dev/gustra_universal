import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { houseAlert, houseSaveChangesAlert } from '@/components/ui/HouseAlert';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { SymbolView } from 'expo-symbols';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FeedSwipeDelete } from '@/components/feed/FeedSwipeDelete';
import { InteractiveStarRating } from '@/components/review/InteractiveStarRating';
import { ReorderablePhotoStrip } from '@/components/review/ReorderablePhotoStrip';
import { FavoriteHeartButton } from '@/components/ui/FavoriteHeartButton';
import { HouseNavHeader } from '@/components/ui/HouseNavHeader';
import { HouseToolbarIconButton } from '@/components/ui/HouseToolbarIconButton';
import { PhotoSourceChooserModal } from '@/components/ui/PhotoSourceChooser';
import { SerifText } from '@/components/ui/SerifText';
import {
  FractionalStarRating,
  StaticStarRating,
} from '@/components/ui/StarRating';
import { WineIdentityLink } from '@/components/wine/WineIdentityLink';
import { GustraColors } from '@/constants/Colors';
import { HOUSE_KEYBOARD_APPEARANCE } from '@/constants/Keyboard';
import {
  SERIF_FONT,
  Theme,
  bodyTextStyle,
  captionTextStyle,
} from '@/constants/Theme';
import { useCriteriaSettings } from '@/context/CriteriaSettings';
import { useReviewsStore } from '@/context/ReviewsStore';
import type { CriterionRating, WineLabelFiche } from '@/data/types';
import { useScrollInputIntoView } from '@/hooks/useScrollInputIntoView';
import { stripWineLabelUrisFromPhotoUrls } from '@/services/backup/photos';
import { safeOpenSettings } from '@/services/linking/safeLinking';
import { extractTextFromImages } from '@/services/ocr/OCRService';
import {
  MAX_REVIEW_PHOTOS,
  remainingReviewPhotoSlots,
} from '@/services/reviews/photoLimits';
import { takePendingWineLabelResult } from '@/services/wine/pendingWineLabelResult';
import { setPreviewWineLabelFiche } from '@/services/wine/previewWineLabelFiche';
import {
  averageWineUserRating,
  drinksCommentForDisplay,
  isLegacyStuffedDrinksComment,
  syncWineLabelFields,
  wineLabelsForReview,
} from '@/services/wine/wineLabelTypes';
import {
  draftAddressLine,
  findExistingRestaurant,
  restaurantDraftFromRestaurant,
  type RestaurantDraft,
} from '@/services/places';
import { Haptics } from '@/services/haptics';
import { requestSwipeDelete } from '@/services/swipeDelete';
import {
  deleteReviewPhotoFiles,
  saveReviewPhoto,
} from '@/services/reviews/photoStorage';
import {
  formDraftReason,
  isFormDraft,
  isReviewDraft,
} from '@/services/reviews/draftReview';
import { RatingValue, formatScoreOutOfFive } from '@/services/reviews/ratings';
import { criterionIcon } from '@/services/reviews/criterionIcons';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { i18n } from '@/i18n';
import {
  activeIntlLocale,
  formatAbbreviatedDate,
  formatVisitDateTime,
} from '@/i18n/formatDates';

function openSettingsAlert(message: string) {
  houseAlert(i18n.t('alerts.permission.needed'), message, [
    { text: i18n.t('common.cancel'), style: 'cancel' },
    { text: i18n.t('common.openSettings'), onPress: () => void safeOpenSettings() },
  ]);
}

function parseDraftParam(raw: string | undefined): RestaurantDraft | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as RestaurantDraft;
    if (!parsed?.name?.trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function formatVisitDate(date: Date): string {
  return formatVisitDateTime(date);
}

function formatShortDate(iso: string): string {
  return formatAbbreviatedDate(iso);
}

const GENERAL_COMMENT_KEY = '__general__';

type EditBaseline = {
  visitDateIso: string;
  isFavorite: boolean;
  generalComment: string;
  criteriaState: Record<string, { rating: number; comment: string }>;
  photoUrls: string[];
  ocrText: string;
  wineLabels: WineLabelFiche[];
};

/**
 * Review / Edit form (Swift `ReviewFormView` + `ReviewFormViewModel`).
 * Params: `draft` (JSON), `reviewId` (edit), or `restaurantId` (new visit).
 *
 * New visit: autosave (Swift `handleDisappear`).
 * Edit: explicit save via Done; Back with changes → discard confirm.
 */
export default function ReviewFormScreen() {
  const { t } = useAppTranslation();
  const params = useLocalSearchParams<{
    draft?: string;
    reviewId?: string;
    restaurantId?: string;
  }>();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const {
    scrollRef,
    scrollInputIntoView,
    onScroll,
    clearFocusedInput,
    keyboardHeight,
  } = useScrollInputIntoView();
  const commentInputRefs = useRef<Record<string, TextInput | null>>({});
  const generalCommentRef = useRef<TextInput | null>(null);
  /** Only keep-visible while focused (Swift `ReviewFormCommentField.isFocused`). */
  const focusedCommentKeyRef = useRef<string | null>(null);
  const { enabledCriteria, customCriteria } = useCriteriaSettings();
  const {
    ready,
    restaurants,
    getReview,
    getRestaurant,
    getReviewsForRestaurant,
    upsertReviewFromForm,
    deleteReview,
  } = useReviewsStore();

  const existingReview = params.reviewId
    ? getReview(params.reviewId)
    : undefined;
  const isEdit = Boolean(existingReview);

  const initialDraft = useMemo(() => {
    if (existingReview) {
      const restaurant = getRestaurant(existingReview.restaurantId);
      return restaurant ? restaurantDraftFromRestaurant(restaurant) : null;
    }
    const fromParam = parseDraftParam(params.draft);
    if (fromParam) return fromParam;
    if (params.restaurantId) {
      const restaurant = getRestaurant(params.restaurantId);
      return restaurant ? restaurantDraftFromRestaurant(restaurant) : null;
    }
    return null;
  }, [existingReview, getRestaurant, params.draft, params.restaurantId]);

  const [draft, setDraft] = useState<RestaurantDraft | null>(null);
  const [visitDate, setVisitDate] = useState(() => new Date());
  const [isFavorite, setIsFavorite] = useState(false);
  const [generalComment, setGeneralComment] = useState('');
  const [criteriaState, setCriteriaState] = useState<
    Record<string, { rating: number; comment: string }>
  >({});
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [selectedPhotosForRemoval, setSelectedPhotosForRemoval] = useState<
    string[]
  >([]);
  const [wineLabels, setWineLabels] = useState<WineLabelFiche[]>(() =>
    wineLabelsForReview(existingReview),
  );
  const [pendingWineKeys, setPendingWineKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const wineLabelsRef = useRef(wineLabels);
  wineLabelsRef.current = wineLabels;
  const [activeReviewId, setActiveReviewId] = useState<string | undefined>();
  /** Synced immediately on upsert so Done/unmount cannot create a second review. */
  const activeReviewIdRef = useRef<string | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [isImportingPhotos, setIsImportingPhotos] = useState(false);
  const [showPhotoSourceChooser, setShowPhotoSourceChooser] = useState(false);
  const [isIndexingPhotos, setIsIndexingPhotos] = useState(false);
  const [ocrIndexedText, setOcrIndexedText] = useState(
    () => existingReview?.ocrText ?? '',
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'date' | 'time'>('date');
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [didDelete, setDidDelete] = useState(false);
  const [photoDragging, setPhotoDragging] = useState(false);
  const [ratingScrubbing, setRatingScrubbing] = useState(false);

  /** Stable key for OCR — ignore reorder-only changes. */
  const photoSetKey = useMemo(
    () => [...photoUrls].sort().join('\0'),
    [photoUrls],
  );

  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didHydrate = useRef(false);
  const photoUrlsRef = useRef(photoUrls);
  photoUrlsRef.current = photoUrls;
  const ocrIndexedTextRef = useRef(ocrIndexedText);
  ocrIndexedTextRef.current = ocrIndexedText;
  const ocrIndexGeneration = useRef(0);
  const persistedRef = useRef(Boolean(existingReview));
  const didDeleteRef = useRef(false);
  const initialLoadCompleteRef = useRef(false);
  const persistNowRef = useRef<(markBusy?: boolean) => Promise<boolean>>(
    async () => false,
  );
  const schedulePersistRef = useRef<() => void>(() => undefined);
  /** Serialize form persists so buildInput sees reviewId from the previous upsert. */
  const persistChainRef = useRef(Promise.resolve());
  const editBaselineRef = useRef<EditBaseline | null>(null);
  const isEditRef = useRef(isEdit);
  isEditRef.current = isEdit;
  const isEditDirtyRef = useRef(false);
  const allowLeaveRef = useRef(false);
  didDeleteRef.current = didDelete;

  // Hydrate once store + route params are ready.
  useEffect(() => {
    if (!ready || didHydrate.current || !initialDraft) return;
    didHydrate.current = true;

    setDraft(initialDraft);
    setActiveReviewId(existingReview?.id);
    activeReviewIdRef.current = existingReview?.id;

    if (existingReview) {
      const visitDateValue = new Date(existingReview.date);
      const winesCopy = wineLabelsForReview(existingReview);
      const photoUrlsCopy = stripWineLabelUrisFromPhotoUrls(
        [...existingReview.photoUrls],
        winesCopy,
      );
      const ocrText = existingReview.ocrText ?? '';
      const map: Record<string, { rating: number; comment: string }> = {};
      for (const c of existingReview.criteria) {
        let comment = c.comment;
        if (
          c.id === 'drinks' &&
          isLegacyStuffedDrinksComment(comment, winesCopy)
        ) {
          comment = '';
        }
        map[c.id] = { rating: c.rating, comment };
      }
      // Migrate legacy drinks←wine average onto the Wijnen criterion.
      const wineAvg = averageWineUserRating(winesCopy);
      if (wineAvg != null) {
        if (!map.wines) {
          const drinks = map.drinks;
          if (drinks && drinks.rating === wineAvg) {
            map.wines = { rating: wineAvg, comment: '' };
            map.drinks = { rating: RatingValue.unrated, comment: drinks.comment };
          } else {
            map.wines = { rating: wineAvg, comment: '' };
          }
        }
      }
      const restaurant = getRestaurant(existingReview.restaurantId);
      const favorite = Boolean(restaurant?.isFavorite);

      setVisitDate(visitDateValue);
      setGeneralComment(existingReview.generalComment);
      setPhotoUrls(photoUrlsCopy);
      photoUrlsRef.current = photoUrlsCopy;
      setWineLabels(winesCopy);
      wineLabelsRef.current = winesCopy;
      setOcrIndexedText(ocrText);
      ocrIndexedTextRef.current = ocrText;
      setCriteriaState(map);
      setIsFavorite(favorite);
      persistedRef.current = true;
      editBaselineRef.current = {
        visitDateIso: visitDateValue.toISOString(),
        isFavorite: favorite,
        generalComment: existingReview.generalComment,
        criteriaState: map,
        photoUrls: photoUrlsCopy,
        ocrText,
        wineLabels: winesCopy,
      };
    } else {
      const match = findExistingRestaurant(initialDraft, restaurants);
      setIsFavorite(Boolean(match?.isFavorite));
      setVisitDate(new Date());
      editBaselineRef.current = null;
    }

    requestAnimationFrame(() => {
      setInitialLoadComplete(true);
      initialLoadCompleteRef.current = true;
      // Edit hydrate mounts multiline comments — stay at top (no keep-visible yet).
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    });
  }, [existingReview, getRestaurant, initialDraft, ready, restaurants]);

  const criteriaList: CriterionRating[] = useMemo(
    () =>
      enabledCriteria.map((c) => {
        let comment = criteriaState[c.id]?.comment ?? '';
        if (
          c.id === 'drinks' &&
          isLegacyStuffedDrinksComment(comment, wineLabels)
        ) {
          comment = '';
        }
        return {
          id: c.id,
          title: c.title,
          rating: criteriaState[c.id]?.rating ?? 0,
          comment,
        };
      }),
    [criteriaState, enabledCriteria, wineLabels],
  );

  const matchedRestaurant = useMemo(() => {
    if (!draft) return undefined;
    const reviewId = activeReviewIdRef.current ?? activeReviewId;
    if (reviewId) {
      const review = getReview(reviewId);
      if (review) return getRestaurant(review.restaurantId);
    }
    return findExistingRestaurant(draft, restaurants);
  }, [activeReviewId, draft, getRestaurant, getReview, restaurants]);

  const priorVisits = useMemo(() => {
    if (!matchedRestaurant) return [];
    const skipId =
      activeReviewIdRef.current ?? activeReviewId ?? existingReview?.id;
    return getReviewsForRestaurant(matchedRestaurant.id, 'own').filter(
      (r) => r.id !== skipId,
    );
  }, [
    activeReviewId,
    existingReview?.id,
    getReviewsForRestaurant,
    matchedRestaurant,
  ]);

  const revisitCount = priorVisits.length;
  const scoredPriorVisits = priorVisits.filter((r) => !isReviewDraft(r));
  const revisitAverage =
    scoredPriorVisits.length > 0
      ? scoredPriorVisits.reduce((s, r) => s + r.overallScore, 0) /
        scoredPriorVisits.length
      : 0;
  const lastVisitIso = priorVisits[0]?.date;

  // Restaurant alone is enough to save as Draft; Done always available on this form.
  const showsDone = Boolean(draft);
  const draftReason = formDraftReason(criteriaList, wineLabels);
  const isDraftForm = isFormDraft(criteriaList, wineLabels);

  const customCriterionNames = useMemo(
    () => customCriteria.map((c) => c.name.trim()).filter(Boolean),
    [customCriteria],
  );

  const buildInput = useCallback(() => {
    if (!draft) return null;
    return {
      reviewId: activeReviewIdRef.current,
      draft,
      visitDateIso: visitDate.toISOString(),
      isFavorite,
      generalComment,
      criteria: criteriaList,
      // Prefer ref so reorder/remove in the same tick persist the latest order.
      photoUrls: photoUrlsRef.current,
      ocrText: ocrIndexedText,
      ...syncWineLabelFields(wineLabelsRef.current),
      customCriterionNames,
    };
  }, [
    criteriaList,
    customCriterionNames,
    draft,
    generalComment,
    isFavorite,
    ocrIndexedText,
    visitDate,
  ]);

  const hasPersistableContent = useCallback(() => {
    // Restaurant selected → can save as draft even with no ratings yet.
    if (draft) return true;
    if (isFavorite) return true;
    if (generalComment.trim()) return true;
    if (photoUrls.length > 0) return true;
    if (wineLabels.length > 0) return true;
    return criteriaList.some(
      (c) =>
        RatingValue.isStarRating(c.rating) || c.comment.trim().length > 0,
    );
  }, [
    criteriaList,
    draft,
    generalComment,
    isFavorite,
    photoUrls.length,
    wineLabels.length,
  ]);

  const persistNow = useCallback(
    async (markBusy = false): Promise<boolean> => {
      const run = async (): Promise<boolean> => {
        // After awaiting the chain, the previous upsert has set activeReviewIdRef.
        const input = buildInput();
        if (!input) return false;
        if (
          !hasPersistableContent() &&
          !activeReviewIdRef.current &&
          !existingReview
        ) {
          return false;
        }
        if (markBusy) setIsSaving(true);
        try {
          const result = await upsertReviewFromForm(input);
          if (!result) return false;
          // Sync before any navigation/unmount so a second persist updates this visit.
          activeReviewIdRef.current = result.reviewId;
          setActiveReviewId(result.reviewId);
          persistedRef.current = true;
          return true;
        } finally {
          if (markBusy) setIsSaving(false);
        }
      };

      const queued = persistChainRef.current.then(run, run);
      persistChainRef.current = queued.then(
        () => undefined,
        () => undefined,
      );
      return queued;
    },
    [buildInput, existingReview, hasPersistableContent, upsertReviewFromForm],
  );

  const schedulePersist = useCallback(() => {
    // No silent autosave — Done / “Save changes?” Yes persist explicitly.
    // (Edit mode never autosaved non-photo fields; new visits match that now.)
  }, []);

  /** Photo add/remove/reorder must hit the store immediately — also in edit. */
  const persistPhotosNow = useCallback(() => {
    if (!initialLoadCompleteRef.current) return;
    // New visit: keep photos local until explicit save (Done / Yes).
    if (!isEditRef.current) return;
    void persistNowRef.current(false);
  }, []);

  const afterPhotoChange = useCallback(() => {
    if (isEditRef.current) {
      persistPhotosNow();
      return;
    }
    schedulePersist();
  }, [persistPhotosNow, schedulePersist]);

  persistNowRef.current = persistNow;
  schedulePersistRef.current = schedulePersist;

  const isEditDirty = useMemo(() => {
    if (!isEdit || !editBaselineRef.current || !initialLoadComplete) {
      return false;
    }
    const baseline = editBaselineRef.current;
    if (visitDate.toISOString() !== baseline.visitDateIso) return true;
    if (isFavorite !== baseline.isFavorite) return true;
    if (generalComment !== baseline.generalComment) return true;
    if (ocrIndexedText !== baseline.ocrText) return true;
    if (photoUrls.length !== baseline.photoUrls.length) return true;
    if (photoUrls.some((uri, index) => uri !== baseline.photoUrls[index])) {
      return true;
    }
    if (wineLabels.length !== baseline.wineLabels.length) return true;
    if (
      wineLabels.some(
        (wine, index) =>
          wine.nameAndEstate !== baseline.wineLabels[index]?.nameAndEstate ||
          wine.labelPhotoUri !== baseline.wineLabels[index]?.labelPhotoUri ||
          (wine.userRating ?? 0) !==
            (baseline.wineLabels[index]?.userRating ?? 0) ||
          (wine.userComment ?? '') !==
            (baseline.wineLabels[index]?.userComment ?? ''),
      )
    ) {
      return true;
    }
    for (const criterion of enabledCriteria) {
      const current = criteriaState[criterion.id] ?? {
        rating: 0,
        comment: '',
      };
      const base = baseline.criteriaState[criterion.id] ?? {
        rating: 0,
        comment: '',
      };
      if (current.rating !== base.rating || current.comment !== base.comment) {
        return true;
      }
    }
    return false;
  }, [
    criteriaState,
    enabledCriteria,
    generalComment,
    initialLoadComplete,
    isEdit,
    isFavorite,
    ocrIndexedText,
    photoUrls,
    visitDate,
    wineLabels,
  ]);
  isEditDirtyRef.current = isEditDirty;

  const isNewDirty = useMemo(() => {
    if (isEdit || !initialLoadComplete) return false;
    return hasPersistableContent();
  }, [hasPersistableContent, initialLoadComplete, isEdit]);

  const isFormDirty = isEdit ? isEditDirty : isNewDirty;
  const isFormDirtyRef = useRef(false);
  isFormDirtyRef.current = isFormDirty;

  // OCR index review photos into searchable text (Swift `indexPhotos`).
  // Depend on photo *set*, not order — reorder must not re-index / jump UI.
  useEffect(() => {
    if (!initialLoadComplete) return;
    const generation = ++ocrIndexGeneration.current;
    let cancelled = false;

    const run = async () => {
      if (photoUrlsRef.current.length === 0) {
        if (ocrIndexedTextRef.current) {
          setOcrIndexedText('');
          ocrIndexedTextRef.current = '';
          if (isEditRef.current) {
            void persistNowRef.current(false);
          } else {
            schedulePersistRef.current();
          }
        }
        setIsIndexingPhotos(false);
        return;
      }

      setIsIndexingPhotos(true);
      const text = await extractTextFromImages(photoUrlsRef.current);
      if (cancelled || generation !== ocrIndexGeneration.current) return;
      const next = text.trim();
      if (next !== ocrIndexedTextRef.current) {
        setOcrIndexedText(next);
        ocrIndexedTextRef.current = next;
        if (isEditRef.current) {
          void persistNowRef.current(false);
        } else {
          schedulePersistRef.current();
        }
      }
      setIsIndexingPhotos(false);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [initialLoadComplete, photoSetKey]);

  // Edit: never autosave on leave — Done saves; discard cleans newly added photos.
  // New: no silent save on leave — Done / “Save changes?” Yes; else drop local photos.
  useEffect(() => {
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
      if (isEditRef.current) {
        if (
          !allowLeaveRef.current &&
          !didDeleteRef.current &&
          editBaselineRef.current
        ) {
          const baselinePhotos = new Set(editBaselineRef.current.photoUrls);
          const added = photoUrlsRef.current.filter(
            (uri) => !baselinePhotos.has(uri),
          );
          if (added.length > 0) void deleteReviewPhotoFiles(added);
        }
        return;
      }
      if (allowLeaveRef.current || didDeleteRef.current || persistedRef.current) {
        return;
      }
      const wineUris = wineLabelsRef.current
        .map((w) => w.labelPhotoUri?.trim())
        .filter(Boolean) as string[];
      const uris = [
        ...new Set([...photoUrlsRef.current, ...wineUris].filter(Boolean)),
      ];
      if (uris.length > 0) void deleteReviewPhotoFiles(uris);
    };
  }, []);

  const leaveToReviews = useCallback(() => {
    allowLeaveRef.current = true;
    if (router.canDismiss()) {
      router.dismissAll();
    }
    router.navigate('/(tabs)/(main)');
  }, [router]);

  const discardEditPhotos = useCallback(() => {
    const baseline = editBaselineRef.current;
    if (!baseline) return;
    const baselinePhotos = new Set(baseline.photoUrls);
    const added = photoUrlsRef.current.filter((uri) => !baselinePhotos.has(uri));
    const baselineWineUris = new Set(
      baseline.wineLabels
        .map((w) => w.labelPhotoUri?.trim())
        .filter(Boolean) as string[],
    );
    const addedWineUris = wineLabelsRef.current
      .map((w) => w.labelPhotoUri?.trim())
      .filter((uri): uri is string => Boolean(uri) && !baselineWineUris.has(uri));
    const toDelete = [...added, ...addedWineUris];
    if (toDelete.length > 0) void deleteReviewPhotoFiles(toDelete);
  }, []);

  /** Undo mid-edit photo upserts so Reviews feed matches the discarded state. */
  const restoreEditBaselineToStore = useCallback(async () => {
    const baseline = editBaselineRef.current;
    if (!baseline || !draft || !existingReview) return;
    const criteria = enabledCriteria.map((c) => ({
      id: c.id,
      title: c.title,
      rating: baseline.criteriaState[c.id]?.rating ?? 0,
      comment: baseline.criteriaState[c.id]?.comment ?? '',
    }));
    await upsertReviewFromForm({
      reviewId: existingReview.id,
      draft,
      visitDateIso: baseline.visitDateIso,
      isFavorite: baseline.isFavorite,
      generalComment: baseline.generalComment,
      criteria,
      photoUrls: baseline.photoUrls,
      ocrText: baseline.ocrText,
      ...syncWineLabelFields(baseline.wineLabels),
      customCriterionNames,
    });
  }, [
    customCriterionNames,
    draft,
    enabledCriteria,
    existingReview,
    upsertReviewFromForm,
  ]);

  const discardNewDraft = useCallback(async () => {
    const wineUris = wineLabelsRef.current
      .map((w) => w.labelPhotoUri?.trim())
      .filter(Boolean) as string[];
    const uris = [
      ...new Set([...photoUrlsRef.current, ...wineUris].filter(Boolean)),
    ];
    const id = activeReviewIdRef.current;
    if (id) {
      didDeleteRef.current = true;
      setDidDelete(true);
      await deleteReview(id);
      return;
    }
    if (uris.length > 0) void deleteReviewPhotoFiles(uris);
  }, [deleteReview]);

  const promptDiscardEdits = useCallback(
    (onLeave: () => void) => {
      Haptics.warning();
      houseSaveChangesAlert({
        title: t('alerts.reviewForm.discardEdits.title'),
        onYes: () => {
          void (async () => {
            if (persistTimer.current) clearTimeout(persistTimer.current);
            const ok = await persistNow(true);
            if (!ok) {
              Haptics.warning();
              houseAlert(
                t('forms.review.title'),
                t('alerts.reviewForm.saveFailed'),
              );
              return;
            }
            Haptics.success();
            allowLeaveRef.current = true;
            onLeave();
          })();
        },
        onNo: () => {
          if (isEditRef.current) {
            discardEditPhotos();
            void restoreEditBaselineToStore().finally(() => {
              allowLeaveRef.current = true;
              onLeave();
            });
            return;
          }
          void discardNewDraft().finally(() => {
            allowLeaveRef.current = true;
            onLeave();
          });
        },
      });
    },
    [
      discardEditPhotos,
      discardNewDraft,
      persistNow,
      restoreEditBaselineToStore,
      t,
    ],
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (
        allowLeaveRef.current ||
        didDeleteRef.current ||
        !isFormDirtyRef.current
      ) {
        return;
      }
      event.preventDefault();
      promptDiscardEdits(() => {
        navigation.dispatch(event.data.action);
      });
    });
    return unsubscribe;
  }, [navigation, promptDiscardEdits]);

  const onDone = useCallback(async () => {
    if (isSaving || !showsDone) return;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    const ok = await persistNow(true);
    if (!ok) {
      Haptics.warning();
      houseAlert(t('forms.review.title'), t('alerts.reviewForm.saveFailed'));
      return;
    }
    Haptics.success();
    allowLeaveRef.current = true;
    leaveToReviews();
  }, [isSaving, leaveToReviews, persistNow, showsDone, t]);

  const onBack = useCallback(() => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    // Dirty (new or edit) → beforeRemove shows “Save changes?”
    if (isFormDirty) {
      router.back();
      return;
    }
    allowLeaveRef.current = true;
    router.back();
  }, [isFormDirty, router]);

  const clearAllWines = useCallback(() => {
    const uris = wineLabelsRef.current
      .map((w) => w.labelPhotoUri?.trim())
      .filter(Boolean) as string[];
    setWineLabels([]);
    wineLabelsRef.current = [];
    if (uris.length > 0) {
      void deleteReviewPhotoFiles(uris);
      const banned = new Set(uris);
      setPhotoUrls((prev) => {
        const cleaned = stripWineLabelUrisFromPhotoUrls(
          prev.filter((u) => !banned.has(u.trim())),
          [],
        );
        photoUrlsRef.current = cleaned;
        return cleaned;
      });
    }
  }, []);

  const removeWineAt = useCallback(
    (index: number) => {
      const current = wineLabelsRef.current;
      const removed = current[index];
      const next = current.filter((_, i) => i !== index);
      setWineLabels(next);
      wineLabelsRef.current = next;
      const uri = removed?.labelPhotoUri?.trim();
      if (uri) {
        void deleteReviewPhotoFiles([uri]);
        // Drop deleted wine file from gallery too (legacy rows kept it at [0]).
        setPhotoUrls((prev) => {
          const cleaned = stripWineLabelUrisFromPhotoUrls(
            prev.filter((u) => {
              const t = u.trim();
              return t && t !== uri;
            }),
            next,
          );
          photoUrlsRef.current = cleaned;
          return cleaned;
        });
      }
      if (isEditRef.current) {
        void persistNowRef.current(false);
      } else {
        schedulePersistRef.current();
      }
    },
    [],
  );

  const setCriterionRating = (id: string, rating: number) => {
    const apply = () => {
      setCriteriaState((prev) => ({
        ...prev,
        [id]: {
          rating,
          comment: RatingValue.isStarRating(rating)
            ? (prev[id]?.comment ?? '')
            : '',
        },
      }));
      schedulePersist();
    };

    if (
      id === 'wines' &&
      !RatingValue.isStarRating(rating) &&
      wineLabelsRef.current.length > 0
    ) {
      houseAlert(
        t('wineScan.clearWinesWithRatingsTitle'),
        t('wineScan.clearWinesWithRatingsBody'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.delete'),
            style: 'destructive',
            onPress: () => {
              clearAllWines();
              apply();
            },
          },
        ],
      );
      return;
    }

    apply();
  };

  const setCriterionComment = (id: string, comment: string) => {
    setCriteriaState((prev) => ({
      ...prev,
      [id]: {
        rating: prev[id]?.rating ?? 0,
        comment,
      },
    }));
    schedulePersist();
  };

  const syncWinesRatingFromWines = useCallback((wines: WineLabelFiche[]) => {
    const avg = averageWineUserRating(wines);
    setCriteriaState((prev) => {
      const current = prev.wines ?? {
        rating: RatingValue.unrated,
        comment: '',
      };
      if (avg == null) {
        if (!RatingValue.isStarRating(current.rating)) return prev;
        return {
          ...prev,
          wines: { ...current, rating: RatingValue.unrated },
        };
      }
      if (current.rating === avg) return prev;
      return {
        ...prev,
        wines: {
          rating: avg,
          comment: current.comment,
        },
      };
    });
  }, []);

  useEffect(() => {
    if (wineLabels.length === 0) return;
    syncWinesRatingFromWines(wineLabels);
  }, [syncWinesRatingFromWines, wineLabels]);

  useFocusEffect(
    useCallback(() => {
      const pending = takePendingWineLabelResult();
      if (!pending) return;

      if (typeof pending.removeIndex === 'number') {
        const idx = pending.removeIndex;
        let nextWines = wineLabelsRef.current;
        if (idx >= 0 && idx < nextWines.length) {
          const removed = nextWines[idx];
          nextWines = nextWines.filter((_, i) => i !== idx);
          setWineLabels(nextWines);
          wineLabelsRef.current = nextWines;
          const uri = removed?.labelPhotoUri?.trim();
          if (uri) void deleteReviewPhotoFiles([uri]);
          setPhotoUrls((prev) => {
            const cleaned = stripWineLabelUrisFromPhotoUrls(prev, nextWines);
            photoUrlsRef.current = cleaned;
            return cleaned;
          });
        }
        syncWinesRatingFromWines(nextWines);

        const avg = averageWineUserRating(nextWines);
        const preferredReviewId = pending.leaveToReviewId?.trim();
        const goToReview = (reviewId?: string | null) => {
          const id =
            (reviewId?.trim() ||
              preferredReviewId ||
              activeReviewIdRef.current ||
              existingReview?.id ||
              '') || undefined;
          allowLeaveRef.current = true;
          if (router.canDismiss()) {
            router.dismissAll();
          }
          if (id) {
            router.navigate({
              pathname: '/review/[id]',
              params: { id },
            });
            return;
          }
          router.navigate('/(tabs)/(main)');
        };

        const input = buildInput();
        if (!input) {
          goToReview(preferredReviewId);
          return;
        }

        void upsertReviewFromForm({
          ...input,
          photoUrls: photoUrlsRef.current,
          ...syncWineLabelFields(nextWines),
          criteria: input.criteria.map((c) =>
            c.id === 'wines' && avg != null ? { ...c, rating: avg } : c,
          ),
        }).then(
          (result) => goToReview(result?.reviewId),
          () => goToReview(preferredReviewId),
        );
        return;
      }

      if (!pending.wineLabel) return;

      const incoming = pending.wineLabel;
      // Prefer fields on the fiche; fall back to deprecated pending top-level.
      const withUser: WineLabelFiche = {
        ...incoming,
        userRating: RatingValue.isStarRating(incoming.userRating ?? 0)
          ? incoming.userRating
          : RatingValue.isStarRating(pending.drinksRating ?? 0)
            ? pending.drinksRating
            : incoming.userRating,
        userComment:
          incoming.userComment?.trim() ||
          pending.drinksComment.trim() ||
          undefined,
      };

      let nextWines: WineLabelFiche[];
      if (
        typeof pending.replaceIndex === 'number' &&
        pending.replaceIndex >= 0 &&
        pending.replaceIndex < wineLabelsRef.current.length
      ) {
        nextWines = wineLabelsRef.current.map((w, i) =>
          i === pending.replaceIndex ? withUser : w,
        );
      } else {
        nextWines = [...wineLabelsRef.current, withUser];
      }

      setWineLabels(nextWines);
      wineLabelsRef.current = nextWines;
      setPhotoUrls((prev) => {
        const cleaned = stripWineLabelUrisFromPhotoUrls(prev, nextWines);
        photoUrlsRef.current = cleaned;
        return cleaned;
      });
      syncWinesRatingFromWines(nextWines);

      if (pending.ocrText.trim()) {
        setOcrIndexedText((prev) => {
          const next = [prev, pending.ocrText].filter(Boolean).join(' ').trim();
          ocrIndexedTextRef.current = next;
          return next;
        });
      }
      if (isEditRef.current) {
        void persistNowRef.current(false);
      } else {
        schedulePersistRef.current();
      }
      Haptics.success();
    }, [
      buildInput,
      router,
      syncWinesRatingFromWines,
      upsertReviewFromForm,
    ]),
  );

  const confirmRemoveSelectedPhotos = () => {
    if (selectedPhotosForRemoval.length === 0) return;
    const toRemove = [...selectedPhotosForRemoval];
    houseAlert(
      t('alerts.reviewForm.removePhotosTitle'),
      t('alerts.reviewForm.removePhotosBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.remove'),
          style: 'destructive',
          onPress: () => {
            const removeSet = new Set(toRemove);
            setPhotoUrls((prev) => {
              const next = prev.filter((u) => !removeSet.has(u));
              photoUrlsRef.current = next;
              return next;
            });
            setSelectedPhotosForRemoval([]);
            void deleteReviewPhotoFiles(toRemove);
            afterPhotoChange();
          },
        },
      ],
    );
  };

  const togglePhotoSelection = (uri: string) => {
    setSelectedPhotosForRemoval((prev) =>
      prev.includes(uri) ? prev.filter((u) => u !== uri) : [...prev, uri],
    );
  };

  const warnPhotoLimit = useCallback(() => {
    houseAlert(
      t('alerts.reviewForm.photoLimitTitle'),
      t('alerts.reviewForm.photoLimitBody', { max: MAX_REVIEW_PHOTOS }),
    );
  }, [t]);

  const importFromLibrary = async () => {
    const slots = remainingReviewPhotoSlots(photoUrlsRef.current.length);
    if (slots <= 0) {
      warnPhotoLimit();
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      openSettingsAlert(
        t('alerts.permission.photos'),
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 1,
      selectionLimit: slots,
    });
    if (result.canceled || result.assets.length === 0) return;
    const assets = result.assets.slice(0, slots);
    if (result.assets.length > slots) {
      warnPhotoLimit();
    }
    setIsImportingPhotos(true);
    try {
      const saved: string[] = [];
      for (const asset of assets) {
        if (!asset.uri) continue;
        saved.push(await saveReviewPhoto(asset.uri));
      }
      if (saved.length) {
        Haptics.light();
        setPhotoUrls((prev) => {
          const cleaned = prev.map((u) => u.trim()).filter(Boolean);
          const room = remainingReviewPhotoSlots(cleaned.length);
          const next = [...cleaned, ...saved.slice(0, room)];
          photoUrlsRef.current = next;
          return next;
        });
        afterPhotoChange();
      }
    } catch {
      Haptics.error();
      houseAlert(t('forms.review.photos'), t('alerts.reviewForm.photosSaveFailed'));
    } finally {
      setIsImportingPhotos(false);
    }
  };

  const takePhoto = async () => {
    if (remainingReviewPhotoSlots(photoUrlsRef.current.length) <= 0) {
      warnPhotoLimit();
      return;
    }
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      openSettingsAlert(
        t('alerts.permission.camera'),
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    if (remainingReviewPhotoSlots(photoUrlsRef.current.length) <= 0) {
      warnPhotoLimit();
      return;
    }
    setIsImportingPhotos(true);
    try {
      const uri = await saveReviewPhoto(result.assets[0].uri);
      Haptics.light();
      setPhotoUrls((prev) => {
        const cleaned = prev.map((u) => u.trim()).filter(Boolean);
        if (remainingReviewPhotoSlots(cleaned.length) <= 0) return cleaned;
        const next = [...cleaned, uri];
        photoUrlsRef.current = next;
        return next;
      });
      afterPhotoChange();
    } catch {
      Haptics.error();
      houseAlert(t('forms.review.photos'), t('alerts.photos.saveFailed'));
    } finally {
      setIsImportingPhotos(false);
    }
  };

  const showPhotoSourcePicker = () => {
    if (remainingReviewPhotoSlots(photoUrlsRef.current.length) <= 0) {
      warnPhotoLimit();
      return;
    }
    setShowPhotoSourceChooser(true);
  };

  const confirmDelete = () => {
    if (!activeReviewId && !existingReview) return;
    houseAlert(t('alerts.reviewForm.deleteTitle'), t('alerts.reviewForm.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const id = activeReviewId ?? existingReview?.id;
            if (!id) return;
            setDidDelete(true);
            didDeleteRef.current = true;
            persistedRef.current = true;
            await deleteReview(id);
            leaveToReviews();
          })();
        },
      },
    ]);
  };

  // Tab bar hides while the keyboard is up — pad by keyboard height so comments
  // can scroll clear (same approach as wine note fields).
  const bottomPad =
    keyboardHeight > 0
      ? keyboardHeight + 24
      : Theme.spacing.floatingTabBarClearance + insets.bottom + 24;
  const addressLine = draft ? draftAddressLine(draft) : null;

  if (!ready || !draft) {
    return (
      <View style={styles.screen}>
        <HouseNavHeader
          title={isEdit ? t('forms.review.editTitle') : t('forms.review.title')}
          titleSize={Theme.navigation.secondaryTitleSize}
          showBack
          onBack={() => router.back()}
        />
        <View style={styles.loading}>
          <ActivityIndicator color={GustraColors.forestGreen} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <HouseNavHeader
        title={isEdit ? t('forms.review.editTitle') : t('forms.review.title')}
        titleSize={Theme.navigation.secondaryTitleSize}
        showBack
        onBack={() => void onBack()}
        right={
          showsDone ? (
            <HouseToolbarIconButton
              iosName="checkmark"
              androidName="check"
              accessibilityLabel={t("forms.review.done")}
              disabled={isSaving}
              onPress={() => void onDone()}
            />
          ) : null
        }
      />

      <ScrollView
        ref={scrollRef}
        scrollEnabled={!photoDragging && !ratingScrubbing}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
        overScrollMode="never">
          <View style={styles.card}>
            <View style={styles.restaurantRow}>
              <View style={styles.restaurantCopy}>
                <SerifText style={styles.restaurantName}>{draft.name}</SerifText>
                {addressLine ? (
                  <Text style={styles.address}>{addressLine}</Text>
                ) : null}
              </View>
              <FavoriteHeartButton
                favorite={isFavorite}
                onToggle={(next) => {
                  setIsFavorite(next);
                }}
              />
            </View>
          </View>

          {isDraftForm && draftReason ? (
            <View style={styles.draftBanner}>
              <Text style={styles.draftBannerText}>
                {draftReason === 'wine'
                  ? t('forms.review.draftBannerWine')
                  : t('forms.review.draftBannerCriteria')}
              </Text>
            </View>
          ) : null}

          {revisitCount > 0 ? (
            <View style={styles.card}>
              <Text style={styles.revisitTitle}>
                {t('forms.review.otherVisits', { count: revisitCount })}
              </Text>
              <View style={styles.revisitMeta}>
                {lastVisitIso ? (
                  <Text style={styles.revisitMetaText}>
                    {t('forms.review.mostRecent', { date: formatShortDate(lastVisitIso) })}
                  </Text>
                ) : null}
                {revisitAverage > 0 ? (
                  <View style={styles.revisitScore}>
                    <FractionalStarRating score={revisitAverage} size={16} />
                    <Text style={styles.revisitMetaText}>
                      {t('forms.review.avg', {
                        score: formatScoreOutOfFive(revisitAverage),
                      })}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}

          <View style={styles.card}>
            <FormSectionTitle title={t("forms.review.visitDate")} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("forms.review.visitDate")}
              onPress={() => {
                setDatePickerMode('date');
                setShowDatePicker(true);
              }}
              style={({ pressed }) => [
                styles.dateButton,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.dateLabel}>{formatVisitDate(visitDate)}</Text>
              {Platform.OS === 'ios' ? (
                <SymbolView
                  name="calendar"
                  size={20}
                  tintColor={GustraColors.forestGreen}
                  weight="semibold"
                />
              ) : (
                <MaterialIcons
                  name="calendar-today"
                  size={20}
                  color={GustraColors.forestGreen}
                />
              )}
            </Pressable>
          </View>

          <View style={styles.card}>
            <FormSectionTitle title={t("forms.review.ratings")} />
            {enabledCriteria.map((criterion, offset) => {
              const icons = criterionIcon(criterion.id);
              const state = criteriaState[criterion.id] ?? {
                rating: RatingValue.unrated,
                comment: '',
              };
              const isWines = criterion.id === 'wines';
              const isDrinks = criterion.id === 'drinks';
              const notes = isDrinks
                ? drinksCommentForDisplay(state.comment, wineLabels)
                : state.comment;
              const winesHasBottles = isWines && wineLabels.length > 0;
              const winesAvg = winesHasBottles
                ? averageWineUserRating(wineLabels)
                : null;
              const winesDisplayRating =
                winesAvg ??
                (RatingValue.isStarRating(state.rating) ? state.rating : 0);
              const showCommentField = winesHasBottles
                ? false
                : RatingValue.isStarRating(state.rating) ||
                  (isDrinks && notes.length > 0);
              return (
                <View key={criterion.id}>
                  {offset > 0 ? <View style={styles.divider} /> : null}
                  <View style={styles.criterionRow}>
                    <View style={styles.criterionIcon}>
                      {Platform.OS === 'ios' ? (
                        <SymbolView
                          name={icons.ios as never}
                          size={16}
                          tintColor={GustraColors.forestGreen}
                          weight="semibold"
                        />
                      ) : (
                        <MaterialIcons
                          name={icons.android}
                          size={18}
                          color={GustraColors.forestGreen}
                        />
                      )}
                    </View>
                    <View style={styles.criterionBody}>
                      <SerifText style={styles.criterionTitle}>
                        {criterion.title}
                      </SerifText>
                      {winesHasBottles ? (
                        winesDisplayRating > 0 ? (
                          <StaticStarRating
                            rating={winesDisplayRating}
                            showLabel
                          />
                        ) : null
                      ) : (
                        <InteractiveStarRating
                          rating={state.rating}
                          onChange={(rating) =>
                            setCriterionRating(criterion.id, rating)
                          }
                          onScrubbingChange={setRatingScrubbing}
                        />
                      )}
                      {showCommentField ? (
                        <TextInput
                          ref={(node) => {
                            commentInputRefs.current[criterion.id] = node;
                          }}
                          value={notes}
                          onChangeText={(text) =>
                            setCriterionComment(criterion.id, text)
                          }
                          onFocus={() => {
                            focusedCommentKeyRef.current = criterion.id;
                            scrollInputIntoView(
                              commentInputRefs.current[criterion.id] ?? null,
                            );
                          }}
                          onBlur={() => {
                            if (focusedCommentKeyRef.current === criterion.id) {
                              focusedCommentKeyRef.current = null;
                            }
                            clearFocusedInput();
                          }}
                          onContentSizeChange={() => {
                            if (focusedCommentKeyRef.current !== criterion.id) {
                              return;
                            }
                            scrollInputIntoView(
                              commentInputRefs.current[criterion.id] ?? null,
                              90,
                            );
                          }}
                          placeholder={
                            isWines
                              ? t('wineScan.drinksCommentPlaceholder')
                              : t('forms.review.optionalComment')
                          }
                          placeholderTextColor="rgba(35, 32, 26, 0.4)"
                          multiline
                          keyboardAppearance={HOUSE_KEYBOARD_APPEARANCE}
                          style={styles.commentField}
                        />
                      ) : null}
                      {isWines ? (
                        <View style={styles.wineBlock}>
                          {wineLabels.map((wine, wineIndex) => {
                            const wineKey = `${wine.labelPhotoUri ?? ''}|${wine.nameAndEstate}`;
                            if (pendingWineKeys.has(wineKey)) return null;
                            return (
                            <FeedSwipeDelete
                              key={`${wine.labelPhotoUri}-${wine.nameAndEstate}-${wineIndex}`}
                              id={`wine-${wineIndex}-${wine.labelPhotoUri || wine.nameAndEstate}`}
                              onDelete={() => {
                                const name =
                                  wine.nameAndEstate.trim() ||
                                  t('wineScan.fiche.title');
                                const key = wineKey;
                                requestSwipeDelete({
                                  title: t('wineScan.deleteWineTitle'),
                                  message: t('wineScan.deleteWineBody', {
                                    name,
                                  }),
                                  undoMessage: t('wineScan.deleteWineUndo', {
                                    name,
                                  }),
                                  onHide: () => {
                                    setPendingWineKeys((prev) =>
                                      new Set(prev).add(key),
                                    );
                                  },
                                  onRestore: () => {
                                    setPendingWineKeys((prev) => {
                                      const next = new Set(prev);
                                      next.delete(key);
                                      return next;
                                    });
                                  },
                                  onCommit: () => {
                                    setPendingWineKeys((prev) => {
                                      const next = new Set(prev);
                                      next.delete(key);
                                      return next;
                                    });
                                    const current = wineLabelsRef.current;
                                    const idx = current.findIndex(
                                      (w) =>
                                        `${w.labelPhotoUri ?? ''}|${w.nameAndEstate}` ===
                                        key,
                                    );
                                    if (idx >= 0) removeWineAt(idx);
                                  },
                                });
                              }}
                              cornerRadius={Theme.radius.md}>
                              <WineIdentityLink
                                compact
                                name={wine.nameAndEstate}
                                rating={wine.userRating}
                                onPress={() => {
                                  const restaurantKey =
                                    matchedRestaurant?.id ?? draft?.id ?? '';
                                  const reviewKey =
                                    activeReviewIdRef.current ??
                                    activeReviewId ??
                                    existingReview?.id ??
                                    '';
                                  setPreviewWineLabelFiche(wine, {
                                    editIndex: wineIndex,
                                  });
                                  router.push({
                                    pathname: '/wine-label-fiche',
                                    params: {
                                      preview: '1',
                                      edit: '1',
                                      ...(reviewKey
                                        ? { reviewId: reviewKey }
                                        : {}),
                                      ...(restaurantKey
                                        ? { restaurantId: restaurantKey }
                                        : {}),
                                    },
                                  });
                                }}
                              />
                            </FeedSwipeDelete>
                            );
                          })}
                          <Pressable
                            onPress={() => {
                              Haptics.selectionChanged();
                              router.push('/wine-label-scan');
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={t('wineScan.addButtonA11y')}
                            style={({ pressed }) => [
                              styles.wineScanChip,
                              pressed && styles.wineScanChipPressed,
                            ]}>
                            {Platform.OS === 'ios' ? (
                              <SymbolView
                                name="plus"
                                size={14}
                                tintColor={GustraColors.forestGreen}
                                weight="semibold"
                              />
                            ) : (
                              <MaterialIcons
                                name="add"
                                size={16}
                                color={GustraColors.forestGreen}
                              />
                            )}
                            <Text style={styles.wineScanChipText}>
                              {t('wineScan.addButton')}
                            </Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.card}>
            <FormSectionTitle title={t("forms.review.generalComments")} />
            <TextInput
              ref={generalCommentRef}
              value={generalComment}
              onChangeText={(text) => {
                setGeneralComment(text);
                schedulePersist();
              }}
              onFocus={() => {
                focusedCommentKeyRef.current = GENERAL_COMMENT_KEY;
                scrollInputIntoView(generalCommentRef.current);
              }}
              onBlur={() => {
                if (focusedCommentKeyRef.current === GENERAL_COMMENT_KEY) {
                  focusedCommentKeyRef.current = null;
                }
                clearFocusedInput();
              }}
              onContentSizeChange={() => {
                if (focusedCommentKeyRef.current !== GENERAL_COMMENT_KEY) {
                  return;
                }
                scrollInputIntoView(generalCommentRef.current, 90);
              }}
              placeholder={t("forms.review.optionalComment")}
              placeholderTextColor="rgba(35, 32, 26, 0.4)"
              multiline
              keyboardAppearance={HOUSE_KEYBOARD_APPEARANCE}
              style={[styles.commentField, styles.generalComment]}
            />
          </View>

          <View style={styles.card}>
            <FormSectionTitle title={t("forms.review.photos")} />
            <ReorderablePhotoStrip
              photoUrls={photoUrls}
              selectedUris={selectedPhotosForRemoval}
              onReorder={(next) => {
                photoUrlsRef.current = next;
                setPhotoUrls(next);
                afterPhotoChange();
              }}
              onToggleSelect={togglePhotoSelection}
              onAddPress={showPhotoSourcePicker}
              isImporting={isImportingPhotos}
              canAddPhotos={photoUrls.length < MAX_REVIEW_PHOTOS}
              onDraggingChange={setPhotoDragging}
            />

            {selectedPhotosForRemoval.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("forms.review.removePhotos")}
                onPress={confirmRemoveSelectedPhotos}
                style={({ pressed }) => [
                  styles.removePhotosBtn,
                  pressed && styles.pressed,
                ]}>
                {Platform.OS === 'ios' ? (
                  <SymbolView
                    name="trash"
                    size={16}
                    tintColor={GustraColors.ratingAvoid}
                    weight="semibold"
                  />
                ) : (
                  <MaterialIcons
                    name="delete"
                    size={18}
                    color={GustraColors.ratingAvoid}
                  />
                )}
                <Text style={styles.removePhotosLabel}>{t('forms.review.removePhotos')}</Text>
              </Pressable>
            ) : null}

            {isIndexingPhotos ? (
              <View style={styles.indexingRow}>
                <ActivityIndicator
                  size="small"
                  color={GustraColors.forestGreen}
                />
                <Text style={styles.indexingLabel}>{t('forms.review.indexing')}</Text>
              </View>
            ) : null}
          </View>

          {isEdit || activeReviewId ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("forms.review.delete")}
              onPress={confirmDelete}
              style={({ pressed }) => [
                styles.deleteBtn,
                pressed && styles.pressed,
              ]}>
              {Platform.OS === 'ios' ? (
                <SymbolView
                  name="trash"
                  size={34}
                  tintColor="rgba(199, 71, 66, 0.9)"
                  weight="medium"
                />
              ) : (
                // Ionicons trash-outline matches SF Symbol `trash` more closely
                // than Material `delete-outline`.
                <Ionicons
                  name="trash-outline"
                  size={34}
                  color="rgba(199, 71, 66, 0.9)"
                />
              )}
            </Pressable>
          ) : null}
        </ScrollView>

      <PhotoSourceChooserModal
        visible={showPhotoSourceChooser}
        title={t("forms.review.addPhotos")}
        isImporting={isImportingPhotos}
        onClose={() => {
          if (!isImportingPhotos) setShowPhotoSourceChooser(false);
        }}
        onTakePhoto={() => {
          // Dismiss first so the system camera is not nested under our Modal.
          setShowPhotoSourceChooser(false);
          requestAnimationFrame(() => {
            void takePhoto();
          });
        }}
        onImportPhoto={() => {
          setShowPhotoSourceChooser(false);
          requestAnimationFrame(() => {
            void importFromLibrary();
          });
        }}
      />

      <Modal
        visible={showDatePicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDatePicker(false)}>
        <View style={styles.dateModal}>
          <HouseNavHeader
            title={t("forms.review.visitDate")}
            right={
              <HouseToolbarIconButton
                iosName="checkmark"
                androidName="check"
                accessibilityLabel={t("forms.review.done")}
                onPress={() => setShowDatePicker(false)}
              />
            }
          />
          <ScrollView contentContainerStyle={styles.dateModalBody}>
            <DateTimePicker
              value={visitDate}
              mode={datePickerMode}
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              maximumDate={new Date()}
              themeVariant="light"
              accentColor={GustraColors.forestGreen}
              onChange={(_, selected) => {
                if (Platform.OS === 'android') {
                  setShowDatePicker(false);
                }
                if (!selected) return;
                setVisitDate(selected);
              }}
            />
            {Platform.OS === 'ios' ? (
              <View style={styles.timeBlock}>
                <Text style={styles.timeCaption}>
                  {t('forms.review.time')}
                </Text>
                <DateTimePicker
                  value={visitDate}
                  mode="time"
                  display="spinner"
                  maximumDate={new Date()}
                  themeVariant="light"
                  accentColor={GustraColors.forestGreen}
                  onChange={(_, selected) => {
                    if (!selected) return;
                    setVisitDate(selected);
                  }}
                />
              </View>
            ) : (
              <Pressable
                onPress={() => {
                  setDatePickerMode('time');
                  setShowDatePicker(true);
                }}
                style={styles.androidTimeBtn}>
                <Text style={styles.dateLabel}>
                  {t('forms.review.setTime', {
                    time: visitDate.toLocaleTimeString(activeIntlLocale(), {
                      hour: 'numeric',
                      minute: '2-digit',
                    }),
                  })}
                </Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function FormSectionTitle({ title }: { title: string }) {
  return (
    <View style={styles.sectionTitleWrap}>
      <SerifText style={styles.sectionTitle}>{title}</SerifText>
      <View style={styles.sectionAccent} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GustraColors.cream,
  },
  flex: { flex: 1 },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 16,
  },
  card: {
    backgroundColor: GustraColors.bubble,
    borderRadius: Theme.radius.xxl,
    padding: 16,
    gap: 12,
  },
  draftBanner: {
    backgroundColor: 'rgba(217, 162, 39, 0.14)',
    borderRadius: Theme.radius.xxl,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  draftBannerText: {
    ...bodyTextStyle,
    fontSize: 14,
    fontWeight: '600',
    color: GustraColors.gold,
  },
  restaurantRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  restaurantCopy: {
    flex: 1,
    gap: 4,
  },
  restaurantName: {
    fontSize: 20,
    color: GustraColors.forestGreen,
  },
  address: {
    ...captionTextStyle,
    fontSize: 14,
    color: 'rgba(35, 32, 26, 0.55)',
  },
  revisitTitle: {
    ...bodyTextStyle,
    fontSize: 15,
    color: GustraColors.ink,
  },
  revisitMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
  },
  revisitMetaText: {
    ...captionTextStyle,
    fontSize: 13,
    color: 'rgba(35, 32, 26, 0.55)',
  },
  revisitScore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitleWrap: {
    gap: 6,
  },
  sectionTitle: {
    fontSize: 17,
    color: GustraColors.forestGreen,
  },
  sectionAccent: {
    width: 36,
    height: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(217, 162, 39, 0.55)',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Theme.radius.md,
    backgroundColor: 'rgba(245, 238, 221, 0.85)',
  },
  dateLabel: {
    ...bodyTextStyle,
    flex: 1,
    fontSize: 16,
    color: GustraColors.ink,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(35, 32, 26, 0.12)',
    marginVertical: 14,
  },
  criterionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  criterionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(36, 78, 57, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  criterionBody: {
    flex: 1,
    gap: 8,
  },
  criterionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  criterionTitle: {
    flex: 1,
    fontSize: 16,
    color: GustraColors.ink,
  },
  wineBlock: {
    gap: 8,
  },
  wineScanChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(36, 78, 57, 0.12)',
  },
  wineScanChipPressed: {
    opacity: 0.7,
  },
  wineScanChipText: {
    ...captionTextStyle,
    fontSize: 13,
    fontWeight: '700',
    color: GustraColors.forestGreen,
  },
  commentField: {
    ...bodyTextStyle,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Theme.radius.md,
    backgroundColor: 'rgba(245, 238, 221, 0.85)',
    fontSize: 15,
    color: GustraColors.ink,
    textAlignVertical: 'top',
  },
  generalComment: {
    minHeight: 88,
    maxHeight: 160,
  },
  indexingRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  indexingLabel: {
    ...captionTextStyle,
    fontSize: 14,
    color: GustraColors.forestGreen,
  },
  removePhotosBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: Theme.radius.md,
    backgroundColor: 'rgba(176, 64, 48, 0.14)',
  },
  removePhotosLabel: {
    ...bodyTextStyle,
    fontSize: 16,
    fontWeight: '600',
    color: GustraColors.ratingAvoid,
  },
  deleteBtn: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 12,
  },
  pressed: {
    opacity: 0.7,
  },
  dateModal: {
    flex: 1,
    backgroundColor: GustraColors.cream,
  },
  dateModalBody: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 24,
  },
  timeBlock: {
    marginTop: 20,
    gap: 8,
  },
  timeCaption: {
    fontFamily: SERIF_FONT,
    fontSize: 17,
    color: GustraColors.forestGreen,
    paddingHorizontal: 4,
  },
  androidTimeBtn: {
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Theme.radius.md,
    backgroundColor: GustraColors.bubble,
  },
});
