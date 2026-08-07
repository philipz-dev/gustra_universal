import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FavoriteHeartButton } from '@/components/ui/FavoriteHeartButton';
import { SerifText } from '@/components/ui/SerifText';
import { GustraColors } from '@/constants/Colors';
import { useAppTranslation } from '@/hooks/useAppTranslation';

type RestaurantHeaderCardProps = {
  name: string;
  addressLine: string | null;
  isFavorite: boolean;
  setIsFavorite: (favorite: boolean) => void;
  isDraftForm: boolean;
  draftLabel: string; // t('reviews.draftLabel')
  /** Number of earlier visits to this restaurant (revisit subtitle). */
  revisitCount?: number;
};

export const RestaurantHeaderCard = React.memo(function RestaurantHeaderCard({
  name,
  addressLine,
  isFavorite,
  setIsFavorite,
  isDraftForm,
  draftLabel,
  revisitCount = 0,
}: RestaurantHeaderCardProps) {
  const { t } = useAppTranslation();
  return (
    <View style={styles.card}>
      <View style={styles.restaurantRow}>
        <View style={styles.restaurantCopy}>
          <View style={styles.nameRow}>
            <SerifText style={styles.restaurantName}>{name}</SerifText>
            {isDraftForm && (
              <View style={styles.editorialPill}>
                <Text style={styles.editorialPillText}>{draftLabel}</Text>
              </View>
            )}
          </View>
          {addressLine ? <Text style={styles.address}>{addressLine}</Text> : null}
          {revisitCount > 0 ? (
            <Text style={styles.revisitNote}>
              {t('forms.review.visitedBefore', { count: revisitCount })}
            </Text>
          ) : null}
        </View>
        <FavoriteHeartButton favorite={isFavorite} onToggle={setIsFavorite} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: 'rgba(35, 32, 26, 0.04)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 3,
    elevation: 1,
  },
  restaurantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  restaurantCopy: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  restaurantName: {
    fontSize: 20,
    fontWeight: '700',
    color: GustraColors.ink,
  },
  editorialPill: {
    backgroundColor: 'rgba(199, 71, 66, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(199, 71, 66, 0.25)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  editorialPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(199, 71, 66, 0.85)',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  address: {
    fontSize: 14,
    color: 'rgba(35, 32, 26, 0.5)',
  },
  revisitNote: {
    fontSize: 13,
    fontStyle: 'italic',
    color: 'rgba(36, 78, 57, 0.75)',
  },
});
