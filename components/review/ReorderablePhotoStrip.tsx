import { ActivityIndicator, Image, Platform, StyleSheet, Text, View } from 'react-native';
import {
  NestableDraggableFlatList,
  ScaleDecorator,
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import { TouchableOpacity } from 'react-native-gesture-handler';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolView } from 'expo-symbols';

import { GustraColors } from '@/constants/Colors';
import { captionTextStyle, Theme } from '@/constants/Theme';
import { Haptics } from '@/services/haptics';

const PHOTO_SIZE = 72;
/** Tight spacing between thumbs (Swift-style cluster). */
const PHOTO_GAP = 6;
const CELL_WIDTH = PHOTO_SIZE + PHOTO_GAP;

type ReorderablePhotoStripProps = {
  photoUrls: string[];
  selectedUris: string[];
  onReorder: (next: string[]) => void;
  onToggleSelect: (uri: string) => void;
  onAddPress: () => void;
  isImporting?: boolean;
};

/**
 * Horizontal photo strip: tap to select (batch remove), long-press to reorder.
 * Uses RNGH `TouchableOpacity` (not RN `Pressable`) so iOS does not cancel
 * the drag when the item becomes active — a common NestableDraggableFlatList bug.
 */
export function ReorderablePhotoStrip({
  photoUrls,
  selectedUris,
  onReorder,
  onToggleSelect,
  onAddPress,
  isImporting = false,
}: ReorderablePhotoStripProps) {
  const selected = new Set(selectedUris);

  const renderItem = ({ item, drag, isActive, getIndex }: RenderItemParams<string>) => {
    const index = getIndex() ?? 0;
    const isCover = index === 0;
    const isSelected = selected.has(item);

    return (
      // Fixed cell width — without this, horizontal DraggableFlatList
      // stretches each item across most of the row.
      <View style={styles.cell}>
        <ScaleDecorator activeScale={1.05}>
          <View style={[styles.thumbWrap, isActive && styles.thumbActive]}>
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionChanged();
                onToggleSelect(item);
              }}
              onLongPress={() => {
                Haptics.light();
                drag();
              }}
              delayLongPress={180}
              // Do NOT disable while active — that cancels the pan on iOS.
              activeOpacity={0.92}
              accessibilityRole="image"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={
                isCover
                  ? 'Cover photo. Tap to select, long-press to reorder.'
                  : 'Photo. Tap to select, long-press to reorder.'
              }
              style={styles.thumbHit}>
              <Image source={{ uri: item }} style={styles.thumb} resizeMode="cover" />
              {isSelected ? (
                <View
                  style={styles.selectedRing}
                  pointerEvents="none"
                />
              ) : null}
              {isCover ? (
                <View style={styles.coverBadge} pointerEvents="none">
                  <Text style={styles.coverBadgeText}>Cover</Text>
                </View>
              ) : null}
              {isSelected ? (
                <View style={styles.checkBadge} pointerEvents="none">
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
            </TouchableOpacity>
          </View>
        </ScaleDecorator>
      </View>
    );
  };

  return (
    <View style={styles.wrap}>
      {photoUrls.length > 0 ? (
        <Text style={styles.hint}>
          {photoUrls.length > 1
            ? 'Tap to select · long-press to reorder · first is Cover'
            : 'Tap to select for removal'}
        </Text>
      ) : null}
      <NestableDraggableFlatList
        horizontal
        data={photoUrls}
        keyExtractor={(item) => item}
        onDragBegin={() => Haptics.selectionChanged()}
        onDragEnd={({ data }) => {
          onReorder(data);
          Haptics.light();
        }}
        renderItem={renderItem}
        showsHorizontalScrollIndicator={false}
        // Small distance after long-press so outer NestableScrollContainer
        // does not steal the pan on iOS.
        activationDistance={8}
        dragItemOverflow
        autoscrollSpeed={120}
        autoscrollThreshold={40}
        animationConfig={{ damping: 22, stiffness: 220 }}
        getItemLayout={(_, index) => ({
          length: CELL_WIDTH,
          offset: CELL_WIDTH * index,
          index,
        })}
        containerStyle={styles.list}
        contentContainerStyle={styles.listContent}
        ListFooterComponent={
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Add Photos"
            onPress={onAddPress}
            disabled={isImporting}
            activeOpacity={0.7}
            style={styles.addPhoto}>
            {isImporting ? (
              <ActivityIndicator color={GustraColors.forestGreen} />
            ) : Platform.OS === 'ios' ? (
              <SymbolView
                name="plus"
                size={28}
                tintColor={GustraColors.forestGreen}
                weight="semibold"
              />
            ) : (
              <MaterialIcons name="add" size={30} color={GustraColors.forestGreen} />
            )}
          </TouchableOpacity>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  hint: {
    ...captionTextStyle,
    fontSize: 12,
    color: 'rgba(35, 32, 26, 0.5)',
  },
  list: {
    minHeight: PHOTO_SIZE + 4,
  },
  listContent: {
    alignItems: 'center',
    paddingTop: 4,
    paddingRight: 4,
    paddingBottom: 2,
  },
  cell: {
    width: CELL_WIDTH,
    height: PHOTO_SIZE,
    justifyContent: 'center',
  },
  thumbWrap: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: Theme.radius.sm,
  },
  thumbHit: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
  },
  thumbActive: {
    opacity: 0.98,
    zIndex: 10,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  thumb: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: Theme.radius.sm,
    backgroundColor: 'rgba(36, 78, 57, 0.08)',
  },
  selectedRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Theme.radius.sm,
    borderWidth: 3,
    borderColor: GustraColors.forestGreen,
  },
  coverBadge: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: GustraColors.forestGreen,
  },
  coverBadgeText: {
    ...captionTextStyle,
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  checkBadge: {
    position: 'absolute',
    top: 3,
    right: 3,
    zIndex: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 11,
  },
  addPhoto: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: Theme.radius.sm,
    backgroundColor: 'rgba(36, 78, 57, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(36, 78, 57, 0.35)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
