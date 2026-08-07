import { useCallback, useEffect, useMemo, useRef, useState } from 'react';import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HouseNavHeader } from '@/components/ui/HouseNavHeader';
import { HousePrimaryButton, HousePrimaryButtonRow } from '@/components/ui/HousePrimaryButton';
import { HouseToolbarIconButton } from '@/components/ui/HouseToolbarIconButton';
import { GustraColors } from '@/constants/Colors';
import { Theme, bodyTextStyle, captionTextStyle } from '@/constants/Theme';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import type { LibraryAsset } from '@/services/reviews/photoLibrary';
import { Haptics } from '@/services/haptics';

const PAGE_SIZE = 60;
/** Number of tiles per row — matches the iOS system picker. */
const COLUMNS = 4;
const TILE_GAP = 2;

type PhotoLibraryPickerModalProps = {
  visible: boolean;
  /** How many photos can still be added to the review. */
  selectionLimit: number;
  onCancel: () => void;
  /** Called with the selected asset refs (lightweight `ph://`/content refs). */
  onConfirm: (assets: LibraryAsset[]) => void;
};

/**
 * In-app photo library grid picker (replaces the iOS system picker for
 * multi-select). The system PHPicker interprets drag-while-scrolling as
 * "select every cell your finger passes" — with our own grid, tapping and
 * scrolling are strictly separate gestures (`Pressable` cells in a `FlatList`),
 * so a scroll can never corrupt the selection.
 *
 * Reads assets with `expo-media-library` (legacy `getAssetsAsync`, paged).
 * The returned URIs are lightweight refs (`ph://` on iOS) that React Native's
 * PhotoKit image loader renders as fast, size-limited thumbnails — the full
 * photo is only downloaded when the user confirms and `saveReviewPhoto` runs.
 */
export function PhotoLibraryPickerModal({
  visible,
  selectionLimit,
  onCancel,
  onConfirm,
}: PhotoLibraryPickerModalProps) {
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();

  const [assets, setAssets] = useState<LibraryAsset[]>([]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(true);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [importing, setImporting] = useState(false);

  const loadingMoreRef = useRef(false);
  loadingMoreRef.current = loadingMore;
  const limitRef = useRef(selectionLimit);
  limitRef.current = selectionLimit;

  // Reset state whenever the picker opens (fresh page, fresh selection).
  useEffect(() => {
    if (!visible) return;
    setAssets([]);
    setSelected(new Set());
    setNextCursor(undefined);
    setHasMore(true);
    setLoadingInitial(true);
    setLoadFailed(false);
  }, [visible]);

  const loadPage = useCallback(async (after?: string) => {
    const MediaLibrary = await import('expo-media-library/legacy');
    const page = await MediaLibrary.getAssetsAsync({
      first: PAGE_SIZE,
      after,
      mediaType: [MediaLibrary.MediaType.photo],
      sortBy: [[MediaLibrary.SortBy.creationTime, false]],
    });
    return page;
  }, []);

  const fetchFirstPage = useCallback(async () => {
    setLoadingInitial(true);
    setLoadFailed(false);
    setAssets([]);
    setNextCursor(undefined);
    setHasMore(true);
    try {
      const page = await loadPage();
      setAssets(page.assets);
      setNextCursor(page.endCursor || undefined);
      setHasMore(page.hasNextPage);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoadingInitial(false);
    }
  }, [loadPage]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      try {
        const page = await loadPage();
        if (cancelled) return;
        setAssets(page.assets);
        setNextCursor(page.endCursor || undefined);
        setHasMore(page.hasNextPage);
      } catch {
        if (cancelled) return;
        setLoadFailed(true);
      } finally {
        if (!cancelled) setLoadingInitial(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPage, visible]);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !nextCursor || !hasMore) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const page = await loadPage(nextCursor);
      setAssets((prev) => {
        const seen = new Set(prev.map((a) => a.id));
        const fresh = page.assets.filter((a) => !seen.has(a.id));
        return [...prev, ...fresh];
      });
      setNextCursor(page.endCursor || undefined);
      setHasMore(page.hasNextPage);
    } catch {
      setHasMore(false);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMore, loadPage, nextCursor]);

  const remaining = Math.max(0, selectionLimit - selected.size);
  const selectedCount = selected.size;

  const toggleSelect = useCallback(
    (id: string) => {
      Haptics.selectionChanged();
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else if (remaining > 0) {
          next.add(id);
        } else {
          return prev;
        }
        return next;
      });
    },
    [remaining],
  );

  const clearSelection = useCallback(() => {
    Haptics.light();
    setSelected(new Set());
  }, []);

  const handleConfirm = useCallback(async () => {
    if (selected.size === 0 || importing) return;
    setImporting(true);
    try {
      const picked = assets.filter((a) => selected.has(a.id)).slice(0, limitRef.current);
      onConfirm(picked);
    } finally {
      setImporting(false);
    }
  }, [assets, importing, onConfirm, selected]);

  const handleCancel = useCallback(() => {
    if (importing) return;
    onCancel();
  }, [importing, onCancel]);

  const gridColumns = COLUMNS;
  const tileSize = Math.floor((windowWidth - TILE_GAP * (COLUMNS + 1)) / COLUMNS);

  const renderItem = useCallback(
    ({ item }: { item: LibraryAsset }) => {
      const isSelected = selected.has(item.id);
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: isSelected }}
          accessibilityLabel={
            isSelected
              ? t('forms.photoPicker.a11yDeselect')
              : t('forms.photoPicker.a11ySelect')
          }
          disabled={importing}
          onPress={() => toggleSelect(item.id)}
          style={({ pressed }) => [
            styles.tile,
            { width: tileSize, height: tileSize },
            pressed && styles.tilePressed,
          ]}>
          <Image source={{ uri: item.uri }} style={styles.tileImage} resizeMode="cover" />
          {isSelected ? (
            <View style={styles.selectedOverlay} pointerEvents="none" />
          ) : null}
          {isSelected ? (
            <View style={styles.checkBadge} pointerEvents="none">
              <Text style={styles.checkBadgeText}>✓</Text>
            </View>
          ) : null}
        </Pressable>
      );
    },
    [importing, selected, t, tileSize, toggleSelect],
  );

  const header = useMemo(
    () => (
      <View style={styles.limitRow}>
        <Text style={styles.limitLabel}>
          {remaining > 0
            ? t('forms.photoPicker.remaining', { count: remaining })
            : t('forms.photoPicker.limitReached')}
        </Text>
        {selectedCount > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('forms.photoPicker.clearSelection')}
            hitSlop={8}
            onPress={clearSelection}
            style={({ pressed }) => [
              styles.clearBtn,
              pressed && styles.pressed,
            ]}>
            <Text style={styles.clearLabel}>{t('forms.photoPicker.clearSelection')}</Text>
          </Pressable>
        ) : null}
      </View>
    ),
    [clearSelection, remaining, selectedCount, t],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleCancel}>
      <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 12) }]}>
        <HouseNavHeader
          title={t('forms.photoPicker.title')}
          titlePaddingHorizontal={96}
          left={
            <HouseToolbarIconButton
              iosName="xmark"
              androidName="close"
              accessibilityLabel={t('common.close')}
              onPress={handleCancel}
            />
          }
          right={
            <HouseToolbarIconButton
              iosName="checkmark"
              androidName="check"
              accessibilityLabel={t('forms.review.done')}
              disabled={selectedCount === 0 || importing}
              onPress={() => void handleConfirm()}
            />
          }
        />

        {loadingInitial ? (
          <View style={styles.center}>
            <ActivityIndicator color={GustraColors.forestGreen} size="large" />
          </View>
        ) : loadFailed ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{t('forms.photoPicker.loadFailed')}</Text>
            <HousePrimaryButton
              title={t('forms.photoPicker.retry')}
              onPress={() => void fetchFirstPage()}
            />
          </View>
        ) : (
          <>
            {header}
            <FlatList
              data={assets}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              numColumns={gridColumns}
              columnWrapperStyle={styles.row}
              contentContainerStyle={styles.gridContent}
              showsVerticalScrollIndicator={false}
              onEndReachedThreshold={0.4}
              onEndReached={() => void loadMore()}
              ListFooterComponent={
                loadingMore ? (
                  <View style={styles.footer}>
                    <ActivityIndicator color={GustraColors.forestGreen} />
                  </View>
                ) : null
              }
            />
            <View style={styles.footerBar}>
              <HousePrimaryButtonRow>
                <HousePrimaryButton
                  title={t('forms.photoPicker.clearSelection')}
                  flex
                  disabled={selectedCount === 0 || importing}
                  onPress={clearSelection}
                />
                <HousePrimaryButton
                  title={
                    selectedCount > 0
                      ? t('forms.photoPicker.addSelected', { count: selectedCount })
                      : t('forms.photoPicker.addPhotos')
                  }
                  flex
                  disabled={selectedCount === 0 || importing}
                  onPress={() => void handleConfirm()}
                />
              </HousePrimaryButtonRow>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GustraColors.cream,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  errorText: {
    ...bodyTextStyle,
    fontSize: 15,
    color: 'rgba(35, 32, 26, 0.6)',
    textAlign: 'center',
  },
  limitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  limitLabel: {
    ...captionTextStyle,
    fontSize: 13,
    fontWeight: '600',
    color: GustraColors.forestGreen,
  },
  clearBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  clearLabel: {
    ...captionTextStyle,
    fontSize: 13,
    fontWeight: '600',
    color: GustraColors.ratingAvoid,
  },
  pressed: {
    opacity: 0.6,
  },
  gridContent: {
    paddingHorizontal: TILE_GAP,
    paddingBottom: 8,
  },
  row: {
    gap: TILE_GAP,
    marginBottom: TILE_GAP,
  },
  tile: {
    overflow: 'hidden',
    borderRadius: Theme.radius.sm,
    backgroundColor: 'rgba(36, 78, 57, 0.08)',
  },
  tilePressed: {
    opacity: 0.85,
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(36, 78, 57, 0.25)',
    borderWidth: 2,
    borderColor: GustraColors.forestGreen,
  },
  checkBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: GustraColors.forestGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
  },
  footer: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  footerBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
});
