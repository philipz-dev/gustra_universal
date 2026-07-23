import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  NestableDraggableFlatList,
  ScaleDecorator,
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
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
  onReorder: (next: string[]) => void;
  onRemove: (uri: string) => void;
  onAddPress: () => void;
  isImporting?: boolean;
};

export function ReorderablePhotoStrip({
  photoUrls,
  onReorder,
  onRemove,
  onAddPress,
  isImporting = false,
}: ReorderablePhotoStripProps) {
  const renderItem = ({ item, drag, isActive, getIndex }: RenderItemParams<string>) => {
    const index = getIndex() ?? 0;
    const isCover = index === 0;

    return (
      // Fixed cell width — without this, horizontal DraggableFlatList
      // stretches each item across most of the row.
      <View style={styles.cell}>
        <ScaleDecorator activeScale={1.05}>
          <Pressable
            onLongPress={() => {
              Haptics.light();
              drag();
            }}
            delayLongPress={160}
            disabled={isActive}
            accessibilityRole="image"
            accessibilityLabel={
              isCover
                ? 'Cover photo. Long-press to reorder.'
                : 'Photo. Long-press to reorder.'
            }
            style={[styles.thumbWrap, isActive && styles.thumbActive]}>
            <Image source={{ uri: item }} style={styles.thumb} resizeMode="cover" />
            {isCover ? (
              <View style={styles.coverBadge} pointerEvents="none">
                <Text style={styles.coverBadgeText}>Cover</Text>
              </View>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove photo"
              hitSlop={6}
              onPress={() => onRemove(item)}
              style={({ pressed }) => [
                styles.removeBtn,
                pressed && styles.pressed,
              ]}>
              {Platform.OS === 'ios' ? (
                <SymbolView name="xmark" size={12} tintColor="#FFFFFF" weight="bold" />
              ) : (
                <MaterialIcons name="close" size={14} color="#FFFFFF" />
              )}
            </Pressable>
          </Pressable>
        </ScaleDecorator>
      </View>
    );
  };

  return (
    <View style={styles.wrap}>
      {photoUrls.length > 1 ? (
        <Text style={styles.hint}>Long-press a photo to reorder · first is Cover</Text>
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
        activationDistance={12}
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add Photos"
            onPress={onAddPress}
            disabled={isImporting}
            style={({ pressed }) => [styles.addPhoto, pressed && styles.pressed]}>
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
          </Pressable>
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
    overflow: 'visible',
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
  removeBtn: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: GustraColors.ratingAvoid,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    zIndex: 2,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
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
  pressed: {
    opacity: 0.7,
  },
});
