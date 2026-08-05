import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { houseAlert, type HouseAlertButton } from '@/components/ui/HouseAlert';
import { HousePrimaryButton } from '@/components/ui/HousePrimaryButton';
import { SerifText } from '@/components/ui/SerifText';
import { GustraColors } from '@/constants/Colors';
import { Theme, captionTextStyle, bodyTextStyle } from '@/constants/Theme';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { draftAddressLine } from '@/services/places';
import type { RestaurantDraft } from '@/services/places';

type SelectedRestaurantBannerProps = {
  draft: RestaurantDraft;
  actionTitle: string;
  onAction: () => void;
  onClear: () => void;
  /** Own visits already on record for this restaurant (shows a subtle note). */
  visitedCount?: number;
  /**
   * When provided, shows a bookmark button in the top-right corner. Tapping it
   * toggles the restaurant on/off the bucket list: when already bookmarked it
   * asks to remove, otherwise it asks to add.
   */
  onToggleBucketList?: () => void;
  /** Bucket-list state for the bookmark icon (filled when already on list). */
  inBucketList?: boolean;
};

/** Swift `SelectedRestaurantBanner`. */
export function SelectedRestaurantBanner({
  draft,
  actionTitle,
  onAction,
  onClear,
  visitedCount = 0,
  onToggleBucketList,
  inBucketList = false,
}: SelectedRestaurantBannerProps) {
  const { t } = useAppTranslation();
  const addressLine = draftAddressLine(draft);
  /**
   * Optimistic bucket-list state while the confirm dialog is open: tapping the
   * bookmark flips the icon immediately, and cancelling rolls it back. Only a
   * confirmed press actually toggles the restaurant (via onToggleBucketList).
   */
  const [pendingToggle, setPendingToggle] = useState<boolean | null>(null);
  const displayInBucketList = pendingToggle ?? inBucketList;

  const rollback = () => setPendingToggle(null);

  /** Confirmed press: keep the optimistic icon in the new state, then let the
   *  incoming `inBucketList` prop take over seamlessly. */
  const commit = () => {
    setPendingToggle(!inBucketList);
    onToggleBucketList?.();
  };

  const handleBookmarkPress = () => {
    if (!onToggleBucketList) return;
    const next = !inBucketList;
    // Flip the icon before the dialog appears (cancelling restores it).
    setPendingToggle(next);
    if (inBucketList) {
      houseAlert(
        t('bucketList.removeTitle'),
        t('bucketList.removeBody', { name: draft.name }),
        [
          {
            text: t('common.cancel'),
            style: 'cancel',
            onPress: rollback,
          },
          {
            text: t('bucketList.removeConfirm'),
            style: 'default',
            onPress: commit,
          },
        ] satisfies HouseAlertButton[],
      );
      return;
    }
    houseAlert(
      t('bucketList.addTitle'),
      t('bucketList.addBody', { name: draft.name }),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
          onPress: rollback,
        },
        {
          text: t('bucketList.addConfirm'),
          style: 'default',
          onPress: commit,
        },
      ] satisfies HouseAlertButton[],
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.deselectRestaurant')}
          hitSlop={8}
          onPress={onClear}
          style={({ pressed }) => pressed && styles.pressed}>
          <SymbolView
            name={{
              ios: 'xmark.circle.fill',
              android: 'cancel',
              web: 'cancel',
            }}
            tintColor="rgba(35, 32, 26, 0.35)"
            size={28}
          />
        </Pressable>
        <View style={styles.copy}>
          <Text style={styles.caption}>{t('common.selectedRestaurant')}</Text>
          <SerifText size={17} weight="semibold" style={styles.name}>
            {draft.name}
          </SerifText>
          {visitedCount > 0 ? (
            <View style={styles.visitedRow}>
              <SymbolView
                name={{
                  ios: 'clock.fill',
                  android: 'history',
                  web: 'history',
                }}
                tintColor={GustraColors.gold}
                size={12}
              />
              <Text style={styles.visitedText}>
                {t('reviews.visitedBefore', { count: visitedCount })}
              </Text>
            </View>
          ) : null}
          {addressLine ? (
            <Text style={styles.address}>{addressLine}</Text>
          ) : null}
        </View>
        {onToggleBucketList ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              displayInBucketList
                ? t('bucketList.removeTitle')
                : t('bucketList.addTitle')
            }
            accessibilityState={{ selected: displayInBucketList }}
            hitSlop={8}
            onPress={handleBookmarkPress}
            style={({ pressed }) => [
              styles.bookmarkButton,
              pressed && styles.pressed,
            ]}>
            <SymbolView
              name={{
                ios: displayInBucketList ? 'bookmark.fill' : 'bookmark',
                android: displayInBucketList
                  ? 'bookmark'
                  : 'bookmark_border',
                web: displayInBucketList ? 'bookmark' : 'bookmark_border',
              }}
              tintColor={
                displayInBucketList
                  ? GustraColors.gold
                  : 'rgba(35, 32, 26, 0.45)'
              }
              size={28}
            />
          </Pressable>
        ) : null}
      </View>

      <HousePrimaryButton title={actionTitle} onPress={onAction} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: GustraColors.bubble,
    borderRadius: Theme.radius.xl,
    padding: 16,
    gap: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(36, 78, 57, 0.18)',
    shadowColor: 'rgba(35, 32, 26, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  /** Bookmark sits on the same row as the X, vertically aligned with it. */
  bookmarkButton: {
    alignSelf: 'flex-start',
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  caption: {
    ...captionTextStyle,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: 'rgba(35, 32, 26, 0.55)',
  },
  name: {
    color: GustraColors.ink,
  },
  address: {
    ...bodyTextStyle,
    fontSize: 15,
    color: 'rgba(35, 32, 26, 0.55)',
  },
  visitedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  visitedText: {
    ...captionTextStyle,
    fontSize: 12,
    fontWeight: '600',
    color: GustraColors.gold,
  },
  pressed: {
    opacity: 0.7,
  },
});
