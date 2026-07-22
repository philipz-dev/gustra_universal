import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { SymbolView } from 'expo-symbols';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { InteractiveStarRating } from '@/components/review/InteractiveStarRating';
import { FavoriteHeartButton } from '@/components/ui/FavoriteHeartButton';
import { HouseNavHeader } from '@/components/ui/HouseNavHeader';
import { HouseToolbarIconButton } from '@/components/ui/HouseToolbarIconButton';
import { SerifText } from '@/components/ui/SerifText';
import { FractionalStarRating } from '@/components/ui/StarRating';
import { GustraColors } from '@/constants/Colors';
import {
  SERIF_FONT,
  Theme,
  bodyTextStyle,
  captionTextStyle,
} from '@/constants/Theme';
import { useCriteriaSettings } from '@/context/CriteriaSettings';
import { useReviewsStore } from '@/context/ReviewsStore';
import type { CriterionRating } from '@/data/types';
import {
  draftAddressLine,
  findExistingRestaurant,
  restaurantDraftFromRestaurant,
  type RestaurantDraft,
} from '@/services/places';
import { Haptics } from '@/services/haptics';
import {
  deleteReviewPhotoFiles,
  saveReviewPhoto,
} from '@/services/reviews/photoStorage';
import { RatingValue, hasStarRating } from '@/services/reviews/ratings';

function openSettingsAlert(message: string) {
  Alert.alert('Permission needed', message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Open Settings', onPress: () => void Linking.openSettings() },
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
  return date.toLocaleString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function criterionIcon(id: string): {
  ios: string;
  android: keyof typeof MaterialIcons.glyphMap;
} {
  switch (id) {
    case 'food':
      return { ios: 'fork.knife', android: 'restaurant' };
    case 'drinks':
      return { ios: 'wineglass', android: 'local-bar' };
    case 'service':
      return { ios: 'person.2.fill', android: 'groups' };
    case 'setting':
      return { ios: 'sofa.fill', android: 'chair' };
    case 'valueForMoney':
      return { ios: 'tag.fill', android: 'sell' };
    default:
      return { ios: 'star.circle.fill', android: 'star' };
  }
}

/**
 * Review / Edit form (Swift `ReviewFormView` + `ReviewFormViewModel`).
 * Params: `draft` (JSON), `reviewId` (edit), or `restaurantId` (new visit).
 */
export default function ReviewFormScreen() {
  const params = useLocalSearchParams<{
    draft?: string;
    reviewId?: string;
    restaurantId?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { enabledCriteria } = useCriteriaSettings();
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
  const [selectedForRemoval, setSelectedForRemoval] = useState<Set<string>>(
    () => new Set(),
  );
  const [activeReviewId, setActiveReviewId] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const [isImportingPhotos, setIsImportingPhotos] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'date' | 'time'>('date');
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [didDelete, setDidDelete] = useState(false);

  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didHydrate = useRef(false);
  const photoUrlsRef = useRef(photoUrls);
  photoUrlsRef.current = photoUrls;
  const persistedRef = useRef(Boolean(existingReview));
  const didDeleteRef = useRef(false);
  const initialLoadCompleteRef = useRef(false);
  const persistNowRef = useRef<(markBusy?: boolean) => Promise<boolean>>(
    async () => false,
  );

  // Hydrate once store + route params are ready.
  useEffect(() => {
    if (!ready || didHydrate.current || !initialDraft) return;
    didHydrate.current = true;

    setDraft(initialDraft);
    setActiveReviewId(existingReview?.id);

    if (existingReview) {
      setVisitDate(new Date(existingReview.date));
      setGeneralComment(existingReview.generalComment);
      setPhotoUrls([...existingReview.photoUrls]);
      const map: Record<string, { rating: number; comment: string }> = {};
      for (const c of existingReview.criteria) {
        map[c.id] = { rating: c.rating, comment: c.comment };
      }
      setCriteriaState(map);
      const restaurant = getRestaurant(existingReview.restaurantId);
      setIsFavorite(Boolean(restaurant?.isFavorite));
      persistedRef.current = true;
    } else {
      const match = findExistingRestaurant(initialDraft, restaurants);
      setIsFavorite(Boolean(match?.isFavorite));
      setVisitDate(new Date());
    }

    requestAnimationFrame(() => {
      setInitialLoadComplete(true);
      initialLoadCompleteRef.current = true;
    });
  }, [existingReview, getRestaurant, initialDraft, ready, restaurants]);

  const criteriaList: CriterionRating[] = useMemo(
    () =>
      enabledCriteria.map((c) => ({
        id: c.id,
        title: c.title,
        rating: criteriaState[c.id]?.rating ?? 0,
        comment: criteriaState[c.id]?.comment ?? '',
      })),
    [criteriaState, enabledCriteria],
  );

  const matchedRestaurant = useMemo(() => {
    if (!draft) return undefined;
    if (activeReviewId) {
      const review = getReview(activeReviewId);
      if (review) return getRestaurant(review.restaurantId);
    }
    return findExistingRestaurant(draft, restaurants);
  }, [activeReviewId, draft, getRestaurant, getReview, restaurants]);

  const priorVisits = useMemo(() => {
    if (!matchedRestaurant) return [];
    const skipId = activeReviewId ?? existingReview?.id;
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
  const revisitAverage =
    revisitCount > 0
      ? priorVisits.reduce((s, r) => s + r.overallScore, 0) / revisitCount
      : 0;
  const lastVisitIso = priorVisits[0]?.date;

  const showsDone = hasStarRating(criteriaList);

  const buildInput = useCallback(() => {
    if (!draft) return null;
    return {
      reviewId: activeReviewId,
      draft,
      visitDateIso: visitDate.toISOString(),
      isFavorite,
      generalComment,
      criteria: criteriaList,
      photoUrls,
    };
  }, [
    activeReviewId,
    criteriaList,
    draft,
    generalComment,
    isFavorite,
    photoUrls,
    visitDate,
  ]);

  const hasPersistableContent = useCallback(() => {
    if (isFavorite) return true;
    if (generalComment.trim()) return true;
    if (photoUrls.length > 0) return true;
    return criteriaList.some(
      (c) =>
        RatingValue.isStarRating(c.rating) || c.comment.trim().length > 0,
    );
  }, [criteriaList, generalComment, isFavorite, photoUrls.length]);

  const persistNow = useCallback(
    async (markBusy = false): Promise<boolean> => {
      const input = buildInput();
      if (!input) return false;
      if (
        !hasPersistableContent() &&
        !activeReviewId &&
        !existingReview
      ) {
        return false;
      }
      if (markBusy) setIsSaving(true);
      try {
        const result = await upsertReviewFromForm(input);
        if (!result) return false;
        setActiveReviewId(result.reviewId);
        persistedRef.current = true;
        return true;
      } finally {
        if (markBusy) setIsSaving(false);
      }
    },
    [
      activeReviewId,
      buildInput,
      existingReview,
      hasPersistableContent,
      upsertReviewFromForm,
    ],
  );

  const schedulePersist = useCallback(() => {
    if (!initialLoadComplete || isSaving) return;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      void persistNow(false);
    }, 700);
  }, [initialLoadComplete, isSaving, persistNow]);

  persistNowRef.current = persistNow;

  // Autosave on leave (Swift `handleDisappear`) + cleanup never-persisted photos.
  useEffect(() => {
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
      if (!didDeleteRef.current && initialLoadCompleteRef.current) {
        void persistNowRef.current(false);
      } else if (!persistedRef.current && photoUrlsRef.current.length > 0) {
        void deleteReviewPhotoFiles(photoUrlsRef.current);
      }
    };
  }, []);

  const leaveToReviews = useCallback(() => {
    if (router.canDismiss()) {
      router.dismissAll();
    }
    router.navigate('/(tabs)/(main)');
  }, [router]);

  const onDone = useCallback(async () => {
    if (isSaving || !showsDone) return;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    const ok = await persistNow(true);
    if (!ok) {
      Haptics.warning();
      Alert.alert('Review', 'Add at least one star rating to finish.');
      return;
    }
    Haptics.success();
    leaveToReviews();
  }, [isSaving, leaveToReviews, persistNow, showsDone]);

  const onBack = useCallback(async () => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    if (initialLoadComplete && !didDelete) {
      await persistNow(false);
    }
    router.back();
  }, [didDelete, initialLoadComplete, persistNow, router]);

  const setCriterionRating = (id: string, rating: number) => {
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

  const togglePhotoSelection = (uri: string) => {
    setSelectedForRemoval((prev) => {
      const next = new Set(prev);
      if (next.has(uri)) next.delete(uri);
      else next.add(uri);
      return next;
    });
  };

  const removeSelectedPhotos = () => {
    const toRemove = [...selectedForRemoval];
    if (toRemove.length === 0) return;
    Alert.alert(
      'Remove Photos?',
      'Selected photos will be permanently deleted. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setPhotoUrls((prev) => prev.filter((u) => !selectedForRemoval.has(u)));
            setSelectedForRemoval(new Set());
            void deleteReviewPhotoFiles(toRemove);
            schedulePersist();
          },
        },
      ],
    );
  };

  const importFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      openSettingsAlert(
        'Photo library access is required to add review photos. Enable it in Settings.',
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 1,
      selectionLimit: 10,
    });
    if (result.canceled || result.assets.length === 0) return;
    setIsImportingPhotos(true);
    try {
      const saved: string[] = [];
      for (const asset of result.assets) {
        if (!asset.uri) continue;
        saved.push(await saveReviewPhoto(asset.uri));
      }
      if (saved.length) {
        Haptics.light();
        setPhotoUrls((prev) => [...prev, ...saved]);
        schedulePersist();
      }
    } catch {
      Haptics.error();
      Alert.alert('Photos', 'Could not save one or more photos.');
    } finally {
      setIsImportingPhotos(false);
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      openSettingsAlert(
        'Camera access is required to take review photos. Enable it in Settings.',
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    setIsImportingPhotos(true);
    try {
      const uri = await saveReviewPhoto(result.assets[0].uri);
      Haptics.light();
      setPhotoUrls((prev) => [...prev, uri]);
      schedulePersist();
    } catch {
      Haptics.error();
      Alert.alert('Photos', 'Could not save the photo.');
    } finally {
      setIsImportingPhotos(false);
    }
  };

  const showPhotoSourcePicker = () => {
    Alert.alert('Add Photos', undefined, [
      { text: 'Take Photo', onPress: () => void takePhoto() },
      { text: 'Photo Library', onPress: () => void importFromLibrary() },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const confirmDelete = () => {
    if (!activeReviewId && !existingReview) return;
    Alert.alert('Delete?', 'This review will be permanently removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
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

  const bottomPad =
    Theme.spacing.floatingTabBarClearance + insets.bottom + 24;
  const addressLine = draft ? draftAddressLine(draft) : null;
  const isEdit = Boolean(existingReview);

  if (!ready || !draft) {
    return (
      <View style={styles.screen}>
        <HouseNavHeader
          title={isEdit ? 'Edit' : 'Review'}
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
        title={isEdit ? 'Edit' : 'Review'}
        titleSize={Theme.navigation.secondaryTitleSize}
        showBack
        onBack={() => void onBack()}
        right={
          showsDone ? (
            <HouseToolbarIconButton
              iosName="checkmark"
              androidName="check"
              accessibilityLabel="Done"
              disabled={isSaving}
              onPress={() => void onDone()}
            />
          ) : null
        }
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
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
                  if (initialLoadComplete) void persistNow(false);
                }}
              />
            </View>
          </View>

          {revisitCount > 0 ? (
            <View style={styles.card}>
              <Text style={styles.revisitTitle}>
                {revisitCount === 1
                  ? "You've visited this restaurant once."
                  : `You've visited this restaurant ${revisitCount} times.`}
              </Text>
              <View style={styles.revisitMeta}>
                {lastVisitIso ? (
                  <Text style={styles.revisitMetaText}>
                    Last visit {formatShortDate(lastVisitIso)}
                  </Text>
                ) : null}
                {revisitAverage > 0 ? (
                  <View style={styles.revisitScore}>
                    <FractionalStarRating score={revisitAverage} size={16} />
                    <Text style={styles.revisitMetaText}>
                      {revisitAverage.toFixed(1)} avg
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}

          <View style={styles.card}>
            <FormSectionTitle title="Visit date" />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Visit date"
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
            <FormSectionTitle title="Ratings" />
            {enabledCriteria.map((criterion, offset) => {
              const icons = criterionIcon(criterion.id);
              const state = criteriaState[criterion.id] ?? {
                rating: RatingValue.unrated,
                comment: '',
              };
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
                      <InteractiveStarRating
                        rating={state.rating}
                        onChange={(rating) =>
                          setCriterionRating(criterion.id, rating)
                        }
                      />
                      {RatingValue.isStarRating(state.rating) ? (
                        <TextInput
                          value={state.comment}
                          onChangeText={(text) =>
                            setCriterionComment(criterion.id, text)
                          }
                          placeholder="Optional comment"
                          placeholderTextColor="rgba(35, 32, 26, 0.4)"
                          multiline
                          style={styles.commentField}
                        />
                      ) : null}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.card}>
            <FormSectionTitle title="General comments" />
            <TextInput
              value={generalComment}
              onChangeText={(text) => {
                setGeneralComment(text);
                schedulePersist();
              }}
              placeholder="Optional comment"
              placeholderTextColor="rgba(35, 32, 26, 0.4)"
              multiline
              style={[styles.commentField, styles.generalComment]}
            />
          </View>

          <View style={styles.card}>
            <FormSectionTitle title="Photos" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photoRow}>
              {photoUrls.map((uri) => {
                const selected = selectedForRemoval.has(uri);
                return (
                  <Pressable
                    key={uri}
                    onPress={() => togglePhotoSelection(uri)}
                    style={styles.photoThumbWrap}>
                    <Image source={{ uri }} style={styles.photoThumb} />
                    {selected ? (
                      <View style={styles.photoSelectedRing} />
                    ) : null}
                    {selected ? (
                      <View style={styles.photoCheck}>
                        {Platform.OS === 'ios' ? (
                          <SymbolView
                            name="checkmark.circle.fill"
                            size={22}
                            tintColor={GustraColors.forestGreen}
                          />
                        ) : (
                          <MaterialIcons
                            name="check-circle"
                            size={22}
                            color={GustraColors.forestGreen}
                          />
                        )}
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add Photos"
                onPress={showPhotoSourcePicker}
                disabled={isImportingPhotos}
                style={({ pressed }) => [
                  styles.addPhoto,
                  pressed && styles.pressed,
                ]}>
                {isImportingPhotos ? (
                  <ActivityIndicator color={GustraColors.forestGreen} />
                ) : Platform.OS === 'ios' ? (
                  <SymbolView
                    name="plus"
                    size={28}
                    tintColor={GustraColors.forestGreen}
                    weight="semibold"
                  />
                ) : (
                  <MaterialIcons
                    name="add"
                    size={30}
                    color={GustraColors.forestGreen}
                  />
                )}
              </Pressable>
            </ScrollView>

            {selectedForRemoval.size > 0 ? (
              <Pressable
                onPress={removeSelectedPhotos}
                style={({ pressed }) => [
                  styles.removePhotosBtn,
                  pressed && styles.pressed,
                ]}>
                <Text style={styles.removePhotosLabel}>Remove Photos</Text>
              </Pressable>
            ) : null}
          </View>

          {isEdit || activeReviewId ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete"
              onPress={confirmDelete}
              style={({ pressed }) => [
                styles.deleteBtn,
                pressed && styles.pressed,
              ]}>
              {Platform.OS === 'ios' ? (
                <SymbolView
                  name="trash"
                  size={22}
                  tintColor="rgba(199, 71, 66, 0.85)"
                  weight="medium"
                />
              ) : (
                <MaterialIcons
                  name="delete-outline"
                  size={24}
                  color="rgba(199, 71, 66, 0.85)"
                />
              )}
            </Pressable>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={showDatePicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDatePicker(false)}>
        <View style={[styles.dateModal, { paddingTop: insets.top }]}>
          <HouseNavHeader
            title="Visit date"
            titleSize={Theme.navigation.secondaryTitleSize}
            right={
              <HouseToolbarIconButton
                iosName="checkmark"
                androidName="check"
                accessibilityLabel="Done"
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
                if (initialLoadComplete) void persistNow(false);
              }}
            />
            {Platform.OS === 'ios' ? (
              <View style={styles.timeBlock}>
                <Text style={styles.timeCaption}>Time</Text>
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
                    if (initialLoadComplete) void persistNow(false);
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
                  Set time ·{' '}
                  {visitDate.toLocaleTimeString(undefined, {
                    hour: 'numeric',
                    minute: '2-digit',
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
  criterionTitle: {
    fontSize: 16,
    color: GustraColors.ink,
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
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 2,
  },
  photoThumbWrap: {
    width: 72,
    height: 72,
  },
  photoThumb: {
    width: 72,
    height: 72,
    borderRadius: Theme.radius.sm,
  },
  photoSelectedRing: {
    ...StyleSheet.absoluteFill,
    borderRadius: Theme.radius.sm,
    borderWidth: 3,
    borderColor: GustraColors.forestGreen,
  },
  photoCheck: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 11,
  },
  addPhoto: {
    width: 72,
    height: 72,
    borderRadius: Theme.radius.sm,
    backgroundColor: 'rgba(36, 78, 57, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(36, 78, 57, 0.35)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePhotosBtn: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: Theme.radius.md,
    backgroundColor: 'rgba(199, 71, 66, 0.14)',
    alignItems: 'center',
  },
  removePhotosLabel: {
    ...bodyTextStyle,
    fontWeight: '600',
    fontSize: 16,
    color: GustraColors.ratingAvoid,
  },
  deleteBtn: {
    alignSelf: 'center',
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
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
