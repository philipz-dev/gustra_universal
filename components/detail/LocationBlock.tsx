import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { SerifText } from '@/components/ui/SerifText';
import { GustraColors } from '@/constants/Colors';
import { Theme } from '@/constants/Theme';
import type { Restaurant } from '@/data/types';

type LocationBlockProps = {
  restaurant: Restaurant;
  onDirections?: () => void;
};

export function LocationBlock({ restaurant, onDirections }: LocationBlockProps) {
  return (
    <View style={styles.section}>
      <SerifText size={20} weight="bold" style={styles.title}>
        Location
      </SerifText>
      <View style={styles.row}>
        <View style={styles.copy}>
          {restaurant.address ? (
            <Pressable onPress={onDirections} accessibilityRole="link">
              <Text style={styles.link}>{restaurant.address}</Text>
            </Pressable>
          ) : null}
          {restaurant.city ? <Text style={styles.city}>{restaurant.city}</Text> : null}
          {restaurant.phone ? <Text style={styles.phone}>{restaurant.phone}</Text> : null}
          <Pressable
            onPress={onDirections}
            style={styles.directionsRow}
            accessibilityRole="button">
            <SymbolView
              name={{ ios: 'mappin.and.ellipse', android: 'place', web: 'place' }}
              tintColor={GustraColors.forestGreen}
              size={16}
            />
            <Text style={styles.link}>Get directions</Text>
          </Pressable>
        </View>
        <View style={styles.mapThumb}>
          <SymbolView
            name={{ ios: 'map.fill', android: 'map', web: 'map' }}
            tintColor={GustraColors.forestGreen}
            size={24}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
  title: {
    color: GustraColors.ink,
  },
  row: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  link: {
    color: GustraColors.forestGreen,
    fontSize: 15,
  },
  city: {
    fontSize: 14,
    color: 'rgba(35, 32, 26, 0.6)',
  },
  phone: {
    fontSize: 14,
    color: 'rgba(35, 32, 26, 0.7)',
    marginTop: 2,
  },
  directionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
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
