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

  const handleBookmarkPress = () => {
    if (!onToggleBucketList) return;
    if (inBucketList) {
      houseAlert(
        t('bucketList.removeTitle'),
        t('bucketList.removeBody', { name: draft.name }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('bucketList.removeConfirm'),
            style: 'default',
            onPress: () => onToggleBucketList(),
          },
        ] satisfies HouseAlertButton[],
      );
      return;
    }
    houseAlert(
      t('bucketList.addTitle'),
      t('bucketList.addBody', { name: draft.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('bucketList.addConfirm'),
          style: 'default',
          onPress: () => onToggleBucketList(),
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
              inBucketList
                ? t('bucketList.removeTitle')
                : t('bucketList.addTitle')
            }
            accessibilityState={{ selected: inBucketList }}
            hitSlop={8}
            onPress={handleBookmarkPress}
            style={({ pressed }) => [
              styles.bookmarkButton,
              pressed && styles.pressed,
            ]}>
            <SymbolView
              name={{
                ios: inBucketList ? 'bookmark.fill' : 'bookmark',
                android: inBucketList ? 'bookmark' : 'bookmark_border',
                web: inBucketList ? 'bookmark' : 'bookmark_border',
              }}
              tintColor={
                inBucketList
                  ? GustraColors.gold
                  : 'rgba(35, 32, 26, 0.45)'
              }
              size={30}
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
  /** Bookmark peeks over the card's top edge; horizontal position unchanged. */
  bookmarkButton: {
    marginTop: -16,
    zIndex: 2,
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
