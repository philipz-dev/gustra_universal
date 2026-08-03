import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FeedSwipeDelete } from '@/components/feed/FeedSwipeDelete';
import { InteractiveStarRating } from '@/components/review/InteractiveStarRating';
import { ReorderablePhotoStrip } from '@/components/review/ReorderablePhotoStrip';
import { RestaurantHeaderCard } from '@/components/review/RestaurantHeaderCard';
import { DatePickerModal } from '@/components/review/DatePickerModal';
import { RevisitStatsCard } from '@/components/review/RevisitStatsCard';
import { HouseNavHeader } from '@/components/ui/HouseNavHeader';
import { HouseToolbarIconButton } from '@/components/ui/HouseToolbarIconButton';
import { PhotoSourceChooserModal } from '@/components/ui/PhotoSourceChooser';
import { SerifText } from '@/components/ui/SerifText';
import { StaticStarRating } from '@/components/ui/StarRating';
import { WineIdentityLink } from '@/components/wine/WineIdentityLink';
import { GustraColors } from '@/constants/Colors';
import { HOUSE_KEYBOARD_APPEARANCE } from '@/constants/Keyboard';
import { Theme, bodyTextStyle, captionTextStyle } from '@/constants/Theme';
import { useCriteriaSettings } from '@/context/CriteriaSettings';
import { useScrollInputIntoView } from '@/hooks/useScrollInputIntoView';
import { useReviewFormState } from '@/hooks/useReviewFormState';

import { MAX_REVIEW_PHOTOS } from '@/services/reviews/photoLimits';
import { setPreviewWineLabelFiche } from '@/services/wine/previewWineLabelFiche';
import {
  averageWineUserRating,
  drinksCommentForDisplay,
} from '@/services/wine/wineLabelTypes';
import { draftAddressLine } from '@/services/places';
import { Haptics } from '@/services/haptics';
import { RatingValue, formatScoreOutOfFive } from '@/services/reviews/ratings';
import { criterionIcon } from '@/services/reviews/criterionIcons';
import { requestSwipeDelete } from '@/services/swipeDelete';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import {
  activeIntlLocale,
  formatAbbreviatedDate,
  formatVisitDateTime,
} from '@/i18n/formatDates';

function formatVisitDate(date: Date): string {
  return formatVisitDateTime(date);
}

function formatShortDate(iso: string): string {
  return formatAbbreviatedDate(iso);
}

const GENERAL_COMMENT_KEY = '__general__';

export default function ReviewFormScreen() {
  const { t } = useAppTranslation();
  const router = useRouter();
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
  const focusedCommentKeyRef = useRef<string | null>(null);
  const { enabledCriteria } = useCriteriaSettings();

  // The five core criteria always stay visible; the rest collapse behind a
  // "More criteria" toggle so a long criteria list never overwhelms the form.
  const CORE_CRITERION_IDS = useRef([
    'food',
    'drinks',
    'service',
    'setting',
    'valueForMoney',
  ]).current;
  const coreCriteria = enabledCriteria.filter((c) =>
    CORE_CRITERION_IDS.includes(c.id),
  );
  const extraCriteria = enabledCriteria.filter(
    (c) => !CORE_CRITERION_IDS.includes(c.id),
  );
  const [extendedOpen, setExtendedOpen] = useState(
    () => extraCriteria.some((c) => (criteriaState[c.id]?.rating ?? 0) > 0),
  );
  const visibleCriteria = extendedOpen
    ? enabledCriteria
    : coreCriteria;

  const state = useReviewFormState();
  const {
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
  } = state;

  const {
    photoUrls,
    setPhotoUrls,
    photoUrlsRef,
    selectedPhotosForRemoval,
    isImportingPhotos,
    showPhotoSourceChooser,
    setShowPhotoSourceChooser,
    importFromLibrary,
    takePhoto,
    showPhotoSourcePicker,
    confirmRemoveSelectedPhotos,
    togglePhotoSelection,
  } = photoManager;

  const bottomPad =
    keyboardHeight > 0
      ? keyboardHeight + 24
      : Theme.spacing.floatingTabBarClearance + insets.bottom + 24;
  const addressLine = draft ? draftAddressLine(draft) : null;

  const bannerTitle = isEdit
    ? t('forms.review.editTitle')
    : t('forms.addReview.title');

  if (!ready || !draft) {
    return (
      <View style={styles.screen}>
        <HouseNavHeader
          title={bannerTitle}
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
        title={bannerTitle}
        titleSize={Theme.navigation.secondaryTitleSize}
        showBack
        onBack={() => void onBack()}
        right={
          showsDone ? (
            <HouseToolbarIconButton
              iosName="checkmark"
              androidName="check"
              accessibilityLabel={t('forms.review.done')}
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
        <RestaurantHeaderCard
          name={draft.name}
          addressLine={addressLine}
          isFavorite={isFavorite}
          setIsFavorite={setIsFavorite}
          isDraftForm={isDraftForm}
          draftLabel={t('reviews.draftLabel')}
        />

        {isDraftForm && draftReason ? (
          <View style={styles.draftHint} accessibilityRole="alert">
            {Platform.OS === 'ios' ? (
              <SymbolView
                name="exclamationmark.circle.fill"
                size={18}
                tintColor={GustraColors.gold}
              />
            ) : (
              <MaterialIcons
                name="error-outline"
                size={20}
                color={GustraColors.gold}
              />
            )}
            <Text style={styles.draftHintText}>
              {draftReason === 'wine'
                ? t('forms.review.draftBannerWine')
                : t('forms.review.draftBannerFood')}
            </Text>
          </View>
        ) : null}

        <RevisitStatsCard
          revisitCount={revisitCount}
          lastVisitIso={lastVisitIso}
          revisitAverage={revisitAverage}
          formatShortDate={formatShortDate}
          formatScoreOutOfFive={formatScoreOutOfFive}
          t={t}
        />

        <View style={styles.card}>
          <FormSectionTitle title={t('forms.review.visitDate')} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('forms.review.visitDate')}
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
          <FormSectionTitle title={t('forms.review.ratings')} />
          {visibleCriteria.map((criterion, offset) => {
            const icons = criterionIcon(criterion.id);
            const stateVal = criteriaState[criterion.id] ?? {
              rating: RatingValue.unrated,
              comment: '',
            };
            const isWines = criterion.id === 'drinks';
            const isDrinks = criterion.id === 'drinks';
            const notes = isDrinks
              ? drinksCommentForDisplay(stateVal.comment, wineLabels)
              : stateVal.comment;
            const winesHasBottles = isWines && wineLabels.length > 0;
            const winesAvg = winesHasBottles
              ? averageWineUserRating(wineLabels)
              : null;
            const winesDisplayRating =
              winesAvg ??
              (RatingValue.isStarRating(stateVal.rating) ? stateVal.rating : 0);
            const showCommentField = winesHasBottles
              ? false
              : RatingValue.isStarRating(stateVal.rating) ||
                (isDrinks && notes.length > 0);
            return (
              <View key={criterion.id}>
                {offset > 0 ? <View style={styles.divider} /> : null}
                <View style={styles.criterionRow}>
                  <View style={styles.criterionIcon}>
                    {Platform.OS === 'ios' ? (
                      <SymbolView
                        name={icons.ios}
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
                    <View style={styles.criterionTitleRow}>
                      <SerifText style={styles.criterionTitle}>
                        {criterion.title}
                      </SerifText>
                      {criterion.id === 'food' ? (
                        <Text style={styles.requiredBadge}>
                          {t('common.required')}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.criterionRating}>
                      {winesHasBottles ? (
                        winesDisplayRating > 0 ? (
                          <StaticStarRating
                            rating={winesDisplayRating}
                            showLabel
                          />
                        ) : null
                      ) : (
                        <InteractiveStarRating
                          rating={stateVal.rating}
                          onChange={(rating) =>
                            setCriterionRating(criterion.id, rating)
                          }
                          onScrubbingChange={setRatingScrubbing}
                        />
                      )}
                    </View>
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
                        }                        placeholderTextColor="rgba(35, 32, 26, 0.4)"
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
                                    removeWineAt(wineIndex);
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
                                  const reviewKey = existingReview?.id ?? '';
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

          {extraCriteria.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                extendedOpen
                  ? t('forms.review.hideMoreCriteria')
                  : t('forms.review.showMoreCriteria', {
                      count: extraCriteria.length,
                    })
              }
              onPress={() => {
                Haptics.selectionChanged();
                setExtendedOpen((prev) => !prev);
              }}
              style={({ pressed }) => [
                styles.moreToggle,
                pressed && styles.moreTogglePressed,
              ]}>
              <View style={styles.moreToggleRow}>
                <Text style={styles.moreToggleLabel}>
                  {extendedOpen
                    ? t('forms.review.hideMoreCriteria')
                    : t('forms.review.showMoreCriteria', {
                        count: extraCriteria.length,
                      })}
                </Text>
                {Platform.OS === 'ios' ? (
                  <SymbolView
                    name={extendedOpen ? 'chevron.up' : 'chevron.down'}
                    size={14}
                    tintColor={GustraColors.forestGreen}
                    weight="semibold"
                  />
                ) : (
                  <MaterialIcons
                    name={extendedOpen ? 'expand-less' : 'expand-more'}
                    size={20}
                    color={GustraColors.forestGreen}
                  />
                )}
              </View>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.card}>
          <FormSectionTitle title={t('forms.review.generalComments')} />
          <TextInput
            ref={generalCommentRef}
            value={generalComment}
            onChangeText={(text) => {
              setGeneralComment(text);
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
            placeholder={t('forms.review.optionalComment')}
            placeholderTextColor="rgba(35, 32, 26, 0.4)"
            multiline
            keyboardAppearance={HOUSE_KEYBOARD_APPEARANCE}
            style={[styles.commentField, styles.generalComment]}
          />
        </View>

        <View style={styles.card}>
          <FormSectionTitle title={t('forms.review.photos')} />
          <ReorderablePhotoStrip
            photoUrls={photoUrls}
            selectedUris={selectedPhotosForRemoval}
            onReorder={(next) => {
              photoUrlsRef.current = next;
              setPhotoUrls(next);
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
              accessibilityLabel={t('forms.review.removePhotos')}
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
              <Text style={styles.removePhotosLabel}>
                {t('forms.review.removePhotos')}
              </Text>
            </Pressable>
          ) : null}

          {isIndexingPhotos ? (
            <View style={styles.indexingRow}>
              <ActivityIndicator size="small" color={GustraColors.forestGreen} />
              <Text style={styles.indexingLabel}>{t('forms.review.indexing')}</Text>
            </View>
          ) : null}
        </View>

        {isEdit || activeReviewId ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('forms.review.delete')}
            onPress={confirmDelete}
            style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}>
            {Platform.OS === 'ios' ? (
              <SymbolView
                name="trash"
                size={34}
                tintColor="rgba(199, 71, 66, 0.9)"
                weight="medium"
              />
            ) : (
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
        title={t('forms.review.addPhotos')}
        isImporting={isImportingPhotos}
        onClose={() => {
          if (!isImportingPhotos) setShowPhotoSourceChooser(false);
        }}
        onTakePhoto={() => {
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

      <DatePickerModal
        visible={showDatePicker}
        visitDate={visitDate}
        setVisitDate={setVisitDate}
        datePickerMode={datePickerMode}
        setDatePickerMode={setDatePickerMode}
        onClose={() => setShowDatePicker(false)}
        activeIntlLocale={activeIntlLocale}
        t={t}
      />
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
  draftHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(217, 162, 39, 0.45)',
    backgroundColor: 'rgba(217, 162, 39, 0.12)',
  },
  draftHintText: {
    ...bodyTextStyle,
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(166, 118, 12, 1)',
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
  moreToggle: {
    marginTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(35, 32, 26, 0.12)',
  },
  moreTogglePressed: {
    opacity: 0.7,
  },
  moreToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  moreToggleLabel: {
    ...bodyTextStyle,
    fontSize: 15,
    fontWeight: '600',
    color: GustraColors.forestGreen,
  },
  criterionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  criterionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(36, 78, 57, 0.08)',
    marginTop: 2,
  },
  criterionBody: {
    flex: 1,
    gap: 10,
  },
  criterionTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 6,
    minHeight: 24,
  },
  criterionTitle: {
    flexShrink: 1,
    flexGrow: 1,
    minWidth: 0,
    fontSize: 17,
    fontWeight: '600',
    color: GustraColors.ink,
  },
  criterionRating: {
    minHeight: 24,
    justifyContent: 'center',
  },
  requiredBadge: {
    ...captionTextStyle,
    fontSize: 11,
    fontWeight: '700',
    color: GustraColors.ratingAvoid,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  commentField: {
    ...bodyTextStyle,
    fontSize: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderRadius: Theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: GustraColors.ink,
    minHeight: 40,
    textAlignVertical: 'top',
  },
  generalComment: {
    minHeight: 100,
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
  removePhotosBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(199, 71, 66, 0.18)',
    borderRadius: Theme.radius.lg,
    marginTop: 4,
  },
  removePhotosLabel: {
    ...captionTextStyle,
    fontSize: 14,
    fontWeight: '600',
    color: GustraColors.ratingAvoid,
  },
  indexingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  indexingLabel: {
    ...captionTextStyle,
    fontSize: 13,
    color: 'rgba(35, 32, 26, 0.45)',
  },
  deleteBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    marginTop: 10,
  },
  pressed: {
    opacity: 0.7,
  },
});
