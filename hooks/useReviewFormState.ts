import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter, useNavigation } from 'expo-router';

import { useReviewsStore } from '@/context/ReviewsStore';
import { useCriteriaSettings } from '@/context/CriteriaSettings';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { usePhotoManager } from '@/hooks/usePhotoManager';
import { houseAlert, houseSaveChangesAlert } from '@/components/ui/HouseAlert';
import { Haptics } from '@/services/haptics';

import type { CriterionRating, WineLabelFiche } from '@/data/types';
import {
  stripWineLabelUrisFromPhotoUrls,
  filterExistingLocalPhotos,
} from '@/services/backup/photos';
import { extractTextFromImages } from '@/services/ocr/OCRService';
import { deleteReviewPhotoFiles } from '@/services/reviews/photoStorage';
import { RatingValue } from '@/services/reviews/ratings';
import {
  formDraftReason,
  hasRequiredFoodRating,
  isFormDraft,
  isReviewDraft,
} from '@/services/reviews/draftReview';
import { takePendingWineLabelResult } from '@/services/wine/pendingWineLabelResult';
import {
  averageWineUserRating,
  drinksCommentForDisplay,
  isLegacyStuffedDrinksComment,
  syncWineLabelFields,
  wineLabelsForReview,
} from '@/services/wine/wineLabelTypes';
import {
  findExistingRestaurant,
  restaurantDraftFromRestaurant,
  type RestaurantDraft,
} from '@/services/places';

type EditBaseline = {
  visitDateIso: string;
  isFavorite: boolean;
  generalComment: string;
  criteriaState: Record<string, { rating: number; comment: string }>;
  photoUrls: string[];
  ocrText: string;
  wineLabels: WineLabelFiche[];
};

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

export function useReviewFormState() {
  const { t } = useAppTranslation();
  const params = useLocalSearchParams<{
    draft?: string;
    reviewId?: string;
    restaurantId?: string;
  }>();
  const router = useRouter();
  const navigation = useNavigation();

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

  const existingReview = params.reviewId ? getReview(params.reviewId) : undefined;
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

  const afterPhotoChangeRef = useRef<() => void>(() => {});
  const photoManager = usePhotoManager({
    afterPhotoChange: () => afterPhotoChangeRef.current(),
  });
  const { photoUrls, setPhotoUrls, photoUrlsRef } = photoManager;

  const [wineLabels, setWineLabels] = useState<WineLabelFiche[]>(() =>
    wineLabelsForReview(existingReview),
  );
  const [pendingWineKeys, setPendingWineKeys] = useState<Set<string>>(() => new Set());
  const wineLabelsRef = useRef(wineLabels);
  wineLabelsRef.current = wineLabels;
  const [activeReviewId, setActiveReviewId] = useState<string | undefined>();
  const activeReviewIdRef = useRef<string | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [isIndexingPhotos, setIsIndexingPhotos] = useState(false);
  const [ocrIndexedText, setOcrIndexedText] = useState(() => existingReview?.ocrText ?? '');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'date' | 'time'>('date');
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [didDelete, setDidDelete] = useState(false);
  const [photoDragging, setPhotoDragging] = useState(false);
  const [ratingScrubbing, setRatingScrubbing] = useState(false);

  const photoSetKey = useMemo(() => [...photoUrls].sort().join('\0'), [photoUrls]);

  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didHydrate = useRef(false);
  const ocrIndexedTextRef = useRef(ocrIndexedText);
  ocrIndexedTextRef.current = ocrIndexedText;
  const ocrIndexGeneration = useRef(0);
  const persistedRef = useRef(Boolean(existingReview));
  const didDeleteRef = useRef(false);
  const initialLoadCompleteRef = useRef(false);
  const persistNowRef = useRef<(markBusy?: boolean) => Promise<boolean>>(async () => false);
  const schedulePersistRef = useRef<() => void>(() => undefined);
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
        if (c.id === 'drinks' && isLegacyStuffedDrinksComment(comment, winesCopy)) {
          comment = '';
        }
        map[c.id] = { rating: c.rating, comment };
      }
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
    });
  }, [existingReview, getRestaurant, initialDraft, ready, restaurants]);

  // Auto-remove broken photo references when opening an existing review: refs
  // whose local file is missing (e.g. orphaned paths after a restore) would
  // otherwise show as empty slots in the edit strip. Runs once after hydrate,
  // rewrites state + refs + baseline so it never marks the form as "dirty".
  useEffect(() => {
    if (!ready || !initialLoadComplete || !existingReview || !didHydrate.current) {
      return;
    }
    let cancelled = false;
    (async () => {
      const current = photoUrlsRef.current;
      const hasLocalRef = current.some(
        (u) => u.trim() && !u.trim().startsWith('http'),
      );
      if (!hasLocalRef) return;
      const { photoUrls: kept } = await filterExistingLocalPhotos(current);
      if (cancelled || kept.length === current.length) return;
      photoUrlsRef.current = kept;
      setPhotoUrls(kept);
      const baseline = editBaselineRef.current;
      if (baseline) {
        editBaselineRef.current = { ...baseline, photoUrls: kept };
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [existingReview, filterExistingLocalPhotos, initialLoadComplete, ready]);

  const criteriaList: CriterionRating[] = useMemo(
    () =>
      enabledCriteria.map((c) => {
        let comment = criteriaState[c.id]?.comment ?? '';
        if (c.id === 'drinks' && isLegacyStuffedDrinksComment(comment, wineLabels)) {
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
    const skipId = activeReviewIdRef.current ?? activeReviewId ?? existingReview?.id;
    return getReviewsForRestaurant(matchedRestaurant.id, 'own').filter((r) => r.id !== skipId);
  }, [activeReviewId, existingReview?.id, getReviewsForRestaurant, matchedRestaurant]);

  const revisitCount = priorVisits.length;
  const scoredPriorVisits = priorVisits.filter((r) => !isReviewDraft(r));
  const revisitAverage =
    scoredPriorVisits.length > 0
      ? scoredPriorVisits.reduce((s, r) => s + r.overallScore, 0) / scoredPriorVisits.length
      : 0;
  const lastVisitIso = priorVisits[0]?.date;

  const showsDone = Boolean(draft);
  const draftReason = formDraftReason(criteriaList, wineLabels);
  const isDraftForm = isFormDraft(criteriaList, wineLabels);
  const foodRatingRequired = !hasRequiredFoodRating(criteriaList);

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
      photoUrls: photoUrlsRef.current,
      ocrText: ocrIndexedText,
      ...syncWineLabelFields(wineLabelsRef.current),
      customCriterionNames,
    };
  }, [criteriaList, customCriterionNames, draft, generalComment, isFavorite, ocrIndexedText, visitDate]);

  /**
   * True when the user actually entered something (rating, comment, photo,
   * favorite, wine label). A brand-new form that only pre-filled the
   * restaurant (the draft exists) is NOT "content" — backing out of it must
   * not trigger the "save changes?" dialog.
   */
  const hasEnteredContent = useCallback(() => {
    if (isFavorite) return true;
    if (generalComment.trim()) return true;
    if (photoUrls.length > 0) return true;
    if (wineLabels.length > 0) return true;
    return criteriaList.some((c) => RatingValue.isStarRating(c.rating) || c.comment.trim().length > 0);
  }, [criteriaList, generalComment, isFavorite, photoUrls.length, wineLabels.length]);

  const hasPersistableContent = useCallback(() => {
    if (draft) return true;
    return hasEnteredContent();
  }, [draft, hasEnteredContent]);

  const persistNow = useCallback(
    async (markBusy = false): Promise<boolean> => {
      const run = async (): Promise<boolean> => {
        const input = buildInput();
        if (!input) return false;
        if (!hasPersistableContent() && !activeReviewIdRef.current && !existingReview) {
          return false;
        }
        if (markBusy) setIsSaving(true);
        try {
          const result = await upsertReviewFromForm(input);
          if (!result) return false;
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

  const schedulePersist = useCallback(() => {}, []);

  const persistPhotosNow = useCallback(() => {
    if (!initialLoadCompleteRef.current) return;
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

  afterPhotoChangeRef.current = afterPhotoChange;
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
    if (photoUrls.some((uri, index) => uri !== baseline.photoUrls[index])) return true;
    if (wineLabels.length !== baseline.wineLabels.length) return true;
    if (
      wineLabels.some(
        (wine, index) =>
          wine.nameAndEstate !== baseline.wineLabels[index]?.nameAndEstate ||
          wine.labelPhotoUri !== baseline.wineLabels[index]?.labelPhotoUri ||
          (wine.userRating ?? 0) !== (baseline.wineLabels[index]?.userRating ?? 0) ||
          (wine.userComment ?? '') !== (baseline.wineLabels[index]?.userComment ?? ''),
      )
    ) {
      return true;
    }
    for (const criterion of enabledCriteria) {
      const current = criteriaState[criterion.id] ?? { rating: 0, comment: '' };
      const base = baseline.criteriaState[criterion.id] ?? { rating: 0, comment: '' };
      if (current.rating !== base.rating || current.comment !== base.comment) {
        return true;
      }
    }
    return false;
  }, [criteriaState, enabledCriteria, generalComment, initialLoadComplete, isEdit, isFavorite, ocrIndexedText, photoUrls, visitDate, wineLabels]);
  isEditDirtyRef.current = isEditDirty;

  const isNewDirty = useMemo(() => {
    if (isEdit || !initialLoadComplete) return false;
    return hasEnteredContent();
  }, [hasEnteredContent, initialLoadComplete, isEdit]);

  const isFormDirty = isEdit ? isEditDirty : isNewDirty;
  const isFormDirtyRef = useRef(false);
  isFormDirtyRef.current = isFormDirty;

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

  useEffect(() => {
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
      if (isEditRef.current) {
        if (!allowLeaveRef.current && !didDeleteRef.current && editBaselineRef.current) {
          const baselinePhotos = new Set(editBaselineRef.current.photoUrls);
          const added = photoUrlsRef.current.filter((uri) => !baselinePhotos.has(uri));
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
      const uris = [...new Set([...photoUrlsRef.current, ...wineUris].filter(Boolean))];
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
      baseline.wineLabels.map((w) => w.labelPhotoUri?.trim()).filter(Boolean) as string[],
    );
    const addedWineUris = wineLabelsRef.current
      .map((w) => w.labelPhotoUri?.trim())
      .filter((uri): uri is string => Boolean(uri) && !baselineWineUris.has(uri));
    const toDelete = [...added, ...addedWineUris];
    if (toDelete.length > 0) void deleteReviewPhotoFiles(toDelete);
  }, []);

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
  }, [customCriterionNames, draft, enabledCriteria, existingReview, upsertReviewFromForm]);

  const discardNewDraft = useCallback(async () => {
    const wineUris = wineLabelsRef.current
      .map((w) => w.labelPhotoUri?.trim())
      .filter(Boolean) as string[];
    const uris = [...new Set([...photoUrlsRef.current, ...wineUris].filter(Boolean))];
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
              houseAlert(t('forms.review.title'), t('alerts.reviewForm.saveFailed'));
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
    [discardEditPhotos, discardNewDraft, persistNow, restoreEditBaselineToStore, t],
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (allowLeaveRef.current || didDeleteRef.current || !isFormDirtyRef.current) {
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
    if (foodRatingRequired) {
      Haptics.warning();
      houseAlert(
        t('alerts.reviewForm.foodRequiredTitle'),
        t('alerts.reviewForm.foodRequiredBody'),
      );
      return;
    }
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
  }, [foodRatingRequired, isSaving, leaveToReviews, persistNow, showsDone, t]);

  const onBack = useCallback(() => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    // New reviews are pushed from a picker stack (nearby / map-search /
    // manual entry). Backing out of a brand-new draft should land on the
    // feed — not step back through the picker — so the user never clicks
    // through a long stack. Edits keep the normal back-to-origin behavior.
    if (!isEditRef.current) {
      if (isFormDirty) {
        // Only ask when something was actually entered. A fresh form with
        // nothing but the pre-filled restaurant discards silently — pressing
        // the FAB and backing out must never prompt "save changes?".
        promptDiscardEdits(() => {
          allowLeaveRef.current = true;
          leaveToReviews();
        });
        return;
      }
      allowLeaveRef.current = true;
      leaveToReviews();
      return;
    }
    if (isFormDirty) {
      router.back();
      return;
    }
    allowLeaveRef.current = true;
    router.back();
  }, [isFormDirty, leaveToReviews, promptDiscardEdits, router]);

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

  const removeWineAt = useCallback((index: number) => {
    const current = wineLabelsRef.current;
    const removed = current[index];
    const next = current.filter((_, i) => i !== index);
    setWineLabels(next);
    wineLabelsRef.current = next;
    const uri = removed?.labelPhotoUri?.trim();
    if (uri) {
      void deleteReviewPhotoFiles([uri]);
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
  }, []);

  const setCriterionRating = (id: string, rating: number) => {
    const apply = () => {
      setCriteriaState((prev) => ({
        ...prev,
        [id]: {
          rating,
          comment: RatingValue.isStarRating(rating) ? (prev[id]?.comment ?? '') : '',
        },
      }));
      schedulePersist();
    };

    if (id === 'wines' && !RatingValue.isStarRating(rating) && wineLabelsRef.current.length > 0) {
      houseAlert(t('wineScan.clearWinesWithRatingsTitle'), t('wineScan.clearWinesWithRatingsBody'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            clearAllWines();
            apply();
          },
        },
      ]);
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
      const current = prev.wines ?? { rating: RatingValue.unrated, comment: '' };
      if (avg == null) {
        if (!RatingValue.isStarRating(current.rating)) return prev;
        return { ...prev, wines: { ...current, rating: RatingValue.unrated } };
      }
      if (current.rating === avg) return prev;
      return { ...prev, wines: { rating: avg, comment: current.comment } };
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

        const preferredReviewId = pending.leaveToReviewId?.trim();
        const goToReview = (reviewId?: string | null) => {
          const id = (reviewId?.trim() || preferredReviewId || activeReviewIdRef.current || existingReview?.id || '') || undefined;
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

        const avg = averageWineUserRating(nextWines);
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
      const withUser: WineLabelFiche = {
        ...incoming,
        userRating: RatingValue.isStarRating(incoming.userRating ?? 0)
          ? incoming.userRating
          : RatingValue.isStarRating(pending.drinksRating ?? 0)
            ? pending.drinksRating
            : incoming.userRating,
        userComment: incoming.userComment?.trim() || pending.drinksComment.trim() || undefined,
      };

      let nextWines: WineLabelFiche[];
      if (
        typeof pending.replaceIndex === 'number' &&
        pending.replaceIndex >= 0 &&
        pending.replaceIndex < wineLabelsRef.current.length
      ) {
        nextWines = wineLabelsRef.current.map((w, i) => (i === pending.replaceIndex ? withUser : w));
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
    }, [buildInput, router, syncWinesRatingFromWines, upsertReviewFromForm]),
  );

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

  return {
    ready,
    isEdit,
    draft,
    existingReview,
    matchedRestaurant,
    activeReviewId,
    visitDate,
    setVisitDate,
    isFavorite,
    setIsFavorite,
    generalComment,
    setGeneralComment,
    criteriaState,
    criteriaList,
    revisitCount,
    lastVisitIso,
    revisitAverage,
    showsDone,
    draftReason,
    isDraftForm,
    wineLabels,
    setWineLabels,
    pendingWineKeys,
    setPendingWineKeys,
    isSaving,
    isIndexingPhotos,
    showDatePicker,
    setShowDatePicker,
    datePickerMode,
    setDatePickerMode,
    photoDragging,
    setPhotoDragging,
    ratingScrubbing,
    setRatingScrubbing,
    photoManager,
    onBack,
    onDone,
    confirmDelete,
    removeWineAt,
    setCriterionRating,
    setCriterionComment,
  };
}
