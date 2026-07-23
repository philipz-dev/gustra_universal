import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { GoogleMapsView } from '@/components/map/GoogleMapsView';
import { SerifText } from '@/components/ui/SerifText';
import { GustraColors } from '@/constants/Colors';
import type { Restaurant } from '@/data/types';
import { presentDirectionsOptions } from '@/services/directions/DirectionsLauncher';
import { resolveCurrentLocation } from '@/services/location/resolveCurrentLocation';
import type { LatLng } from '@/services/places';

type RestaurantMapViewerProps = {
  visible: boolean;
  restaurant: Restaurant;
  onClose: () => void;
};

/**
 * Full-screen map centered on the restaurant (Swift `RestaurantLocationMapViewer`).
 */
export function RestaurantMapViewer({
  visible,
  restaurant,
  onClose,
}: RestaurantMapViewerProps) {
  const insets = useSafeAreaInsets();
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const addressLine = [restaurant.address, restaurant.city, restaurant.country]
    .filter(Boolean)
    .join(', ');

  useEffect(() => {
    if (!visible) {
      setUserLocation(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const location = await resolveCurrentLocation();
      if (!cancelled && location.coords) {
        setUserLocation(location.coords);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.toolbar}>
          <View style={styles.toolbarSpacer} />
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={12}
            style={styles.closeBtn}>
            <SymbolView
              name={{
                ios: 'xmark.circle.fill',
                android: 'cancel',
                web: 'cancel',
              }}
              tintColor="rgba(35, 32, 26, 0.55)"
              size={28}
            />
          </Pressable>
        </View>

        <View style={styles.map}>
          <GoogleMapsView
            initialCenter={{
              latitude: restaurant.latitude,
              longitude: restaurant.longitude,
            }}
            initialZoom={15}
            markers={[
              {
                id: restaurant.id,
                coordinate: {
                  latitude: restaurant.latitude,
                  longitude: restaurant.longitude,
                },
                title: restaurant.name,
                isSelected: true,
              },
            ]}
            showsUserLocation
            userLocation={userLocation}
          />
        </View>

        <Pressable
          style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}
          onPress={() => {
            // Dismiss the map Modal first — ActionSheetIOS / houseAlert Modal
            // presented on top of an RN Modal crashes iOS intermittently.
            onClose();
            presentDirectionsOptions({
              name: restaurant.name,
              addressLine,
              latitude: restaurant.latitude,
              longitude: restaurant.longitude,
              afterModalDismiss: true,
            });
          }}
          accessibilityRole="button"
          accessibilityLabel="Get directions">
          <View style={styles.footerCopy}>
            <SerifText size={18} weight="semibold" style={styles.name}>
              {restaurant.name}
            </SerifText>
            {addressLine ? (
              <Text style={styles.address} numberOfLines={2}>
                {addressLine}
              </Text>
            ) : null}
          </View>
          <SymbolView
            name={{
              ios: 'arrow.triangle.turn.up.right.diamond.fill',
              android: 'directions',
              web: 'directions',
            }}
            tintColor={GustraColors.forestGreen}
            size={22}
          />
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: GustraColors.cream,
  },
  toolbar: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    backgroundColor: GustraColors.cream,
  },
  toolbarSpacer: {
    flex: 1,
  },
  closeBtn: {
    padding: 4,
  },
  map: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: GustraColors.cream,
  },
  footerCopy: {
    flex: 1,
    gap: 4,
  },
  name: {
    color: GustraColors.ink,
  },
  address: {
    fontSize: 14,
    color: 'rgba(35, 32, 26, 0.65)',
  },
});
