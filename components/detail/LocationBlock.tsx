import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { SerifText } from '@/components/ui/SerifText';
import { GustraColors } from '@/constants/Colors';
import { ReviewDetailPresentation } from '@/constants/ReviewDetailPresentation';
import { Theme } from '@/constants/Theme';
import type { Restaurant } from '@/data/types';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { restaurantHasCoordinates } from '@/services/directions/DirectionsLauncher';
import { safeOpenURL } from '@/services/linking/safeLinking';

type LocationBlockProps = {
  restaurant: Restaurant;
  onDirections?: () => void;
  onOpenMap?: () => void;
};

function phoneTelURL(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : null;
}

export function LocationBlock({
  restaurant,
  onDirections,
  onOpenMap,
}: LocationBlockProps) {
  const { t } = useAppTranslation();
  const compact = ReviewDetailPresentation.isStreamlinedEnabled;
  const phoneURL = restaurant.phone ? phoneTelURL(restaurant.phone) : null;
  const hasCoords = restaurantHasCoordinates(
    restaurant.latitude,
    restaurant.longitude,
  );
  const locationText =
    [restaurant.address, restaurant.city, restaurant.country]
      .filter(Boolean)
      .join(', ') || t('detail.location.unknown');

  if (compact) {
    return (
      <View style={styles.sectionCompact}>
        <SerifText size={17} weight="semibold" style={styles.titleCompact}>
          {t('detail.location.title')}
        </SerifText>
        <View style={styles.compactStack}>
          <Pressable
            onPress={hasCoords ? onDirections : undefined}
            disabled={!hasCoords}
            accessibilityRole="button"
            accessibilityHint={t('detail.location.getDirections')}
            style={styles.compactLine}>
            <Text
              style={[styles.link, !hasCoords && styles.muted, styles.compactLink]}
              numberOfLines={2}
              {...(Platform.OS === 'ios'
                ? { dataDetectorType: 'none' as const }
                : null)}>
              {locationText}
            </Text>
            {hasCoords ? (
              <Pressable
                onPress={onOpenMap ?? onDirections}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('detail.location.showMap')}
                style={styles.inlineMapBtn}>
                <SymbolView
                  name={{ ios: 'map.fill', android: 'map', web: 'map' }}
                  tintColor={GustraColors.forestGreen}
                  size={16}
                />
              </Pressable>
            ) : null}
          </Pressable>

          {restaurant.phone ? (
            phoneURL ? (
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={t('detail.location.call', {
                  phone: restaurant.phone,
                })}
                onPress={() => {
                  void safeOpenURL(phoneURL);
                }}
                style={styles.compactLine}>
                <SymbolView
                  name={{
                    ios: 'phone.fill',
                    android: 'phone',
                    web: 'phone',
                  }}
                  tintColor={GustraColors.forestGreen}
                  size={14}
                />
                <Text style={styles.link}>{restaurant.phone}</Text>
              </Pressable>
            ) : (
              <Text style={styles.phone}>{restaurant.phone}</Text>
            )
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <SerifText size={20} weight="bold" style={styles.title}>
        {t('detail.location.title')}
      </SerifText>
      <View style={styles.row}>
        <View style={styles.copy}>
          <Pressable
            onPress={hasCoords ? onDirections : undefined}
            disabled={!hasCoords}
            accessibilityRole="button"
            accessibilityHint={t('detail.location.getDirections')}
            style={styles.locationRow}>
            <SymbolView
              name={{
                ios: 'mappin.circle.fill',
                android: 'place',
                web: 'place',
              }}
              tintColor={GustraColors.forestGreen}
              size={16}
            />
            <Text
              style={[styles.link, !hasCoords && styles.muted]}
              numberOfLines={4}
              {...(Platform.OS === 'ios'
                ? { dataDetectorType: 'none' as const }
                : null)}>
              {locationText}
            </Text>
          </Pressable>

          {restaurant.phone ? (
            phoneURL ? (
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={t('detail.location.call', {
                  phone: restaurant.phone,
                })}
                onPress={() => {
                  void safeOpenURL(phoneURL);
                }}
                style={styles.phoneRow}>
                <SymbolView
                  name={{
                    ios: 'phone.fill',
                    android: 'phone',
                    web: 'phone',
                  }}
                  tintColor={GustraColors.forestGreen}
                  size={15}
                />
                <Text style={styles.link}>{restaurant.phone}</Text>
              </Pressable>
            ) : (
              <Text style={styles.phone}>{restaurant.phone}</Text>
            )
          ) : null}
        </View>

        {hasCoords ? (
          <Pressable
            onPress={onOpenMap ?? onDirections}
            accessibilityRole="button"
            accessibilityLabel={t('detail.location.showMap')}
            style={styles.mapThumb}>
            <SymbolView
              name={{ ios: 'map.fill', android: 'map', web: 'map' }}
              tintColor={GustraColors.forestGreen}
              size={24}
            />
          </Pressable>
        ) : (
          <View style={styles.mapThumb}>
            <SymbolView
              name={{ ios: 'map.fill', android: 'map', web: 'map' }}
              tintColor="rgba(36, 78, 57, 0.35)"
              size={24}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
  sectionCompact: {
    gap: 8,
  },
  accentRule: {
    alignSelf: 'stretch',
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(36, 78, 57, 0.35)',
    marginBottom: 4,
  },
  title: {
    color: GustraColors.ink,
  },
  titleCompact: {
    color: GustraColors.ink,
    fontSize: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  copy: {
    flex: 1,
    gap: 10,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compactStack: {
    gap: 8,
  },
  compactLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compactLink: {
    flex: 1,
  },
  inlineMapBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(36, 78, 57, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  link: {
    flex: 1,
    color: GustraColors.forestGreen,
    fontSize: 15,
  },
  muted: {
    color: 'rgba(35, 32, 26, 0.85)',
  },
  phone: {
    fontSize: 14,
    color: 'rgba(35, 32, 26, 0.7)',
  },
  mapThumb: {
    width: Theme.size.mapThumb,
    height: Theme.size.mapThumb,
    borderRadius: Theme.radius.lg,
    backgroundColor: 'rgba(36, 78, 57, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
