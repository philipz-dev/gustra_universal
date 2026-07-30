import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { houseAlert } from '@/components/ui/HouseAlert';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HouseEmptyState } from '@/components/ui/HouseEmptyState';
import { HouseNavHeader } from '@/components/ui/HouseNavHeader';
import { HouseToolbarIconButton } from '@/components/ui/HouseToolbarIconButton';
import { GustraColors } from '@/constants/Colors';
import { Theme, bodyTextStyle, captionTextStyle } from '@/constants/Theme';
import { useCriteriaSettings } from '@/context/CriteriaSettings';
import {
  clearPendingSharePackage,
  takePendingSharePackage,
} from '@/context/ShareImportLaunch';
import { requestEnableFriendsFilter } from '@/context/pendingFriendsFilter';
import { useReviewsStore } from '@/context/ReviewsStore';
import type { ShareReviewBackup } from '@/services/share/ReviewShareService';
import {
  importSelectedShareReviews,
  overallScoreFromShareReview,
  ShareImportError,
} from '@/services/share/ShareImportService';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { formatAbbreviatedDate } from '@/i18n/formatDates';
import { formatScoreOutOfFive } from '@/services/reviews/ratings';

/**
 * Share-package review picker (Swift `ShareImportSelectionView`).
 */
export default function ShareImportScreen() {
  const { t } = useAppTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { importSharePackage, reviews, restaurants } = useReviewsStore();
  const { enabledCriteria } = useCriteriaSettings();
  const packageData = useMemo(() => takePendingSharePackage(), []);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(packageData?.reviews.map((r) => r.id) ?? []),
  );
  const [isImporting, setIsImporting] = useState(false);

  const enabledIds = useMemo(
    () => new Set(enabledCriteria.map((c) => c.id)),
    [enabledCriteria],
  );

  const restaurantsById = useMemo(() => {
    const map = new Map(
      (packageData?.restaurants ?? []).map((r) => [r.id, r]),
    );
    return map;
  }, [packageData]);

  const allSelected =
    !!packageData &&
    packageData.reviews.length > 0 &&
    selectedIds.size === packageData.reviews.length;

  const navigationTitle = useMemo(() => {
    const name = packageData?.sharedBy.trim() ?? '';
    if (!name) return t('import.title');
    return t('import.from', { name });
  }, [packageData, t]);

  const dismiss = useCallback(() => {
    clearPendingSharePackage();
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/(main)');
  }, [router]);

  const toggleSelectAll = () => {
    if (!packageData) return;
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(packageData.reviews.map((r) => r.id)));
  };

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const rowTitle = (review: ShareReviewBackup) => {
    if (review.restaurantID) {
      const restaurant = restaurantsById.get(review.restaurantID);
      if (restaurant?.name) return restaurant.name;
    }
    return t('import.unknownRestaurant');
  };

  const rowSubtitle = (review: ShareReviewBackup) => {
    const parts: string[] = [];
    if (review.restaurantID) {
      const city = restaurantsById.get(review.restaurantID)?.city?.trim();
      if (city) parts.push(city);
    }
    const score = overallScoreFromShareReview(review, enabledIds);
    if (score > 0) parts.push(formatScoreOutOfFive(score));
    const date = new Date(review.date);
    if (!Number.isNaN(date.getTime())) {
      parts.push(
        formatAbbreviatedDate(review.date),
      );
    }
    return parts.join(' · ');
  };

  const onImport = async () => {
    if (!packageData || selectedIds.size === 0 || isImporting) return;
    setIsImporting(true);
    try {
      const result = await importSelectedShareReviews({
        reviewIds: [...selectedIds],
        package: packageData,
        existingReviews: reviews,
        existingRestaurants: restaurants,
      });
      await importSharePackage(result);
      clearPendingSharePackage();
      // Include friend's reviews after import (shared filter across tabs).
      requestEnableFriendsFilter();
      router.replace('/(tabs)/(main)');
    } catch (error) {
      houseAlert(
        t('common.error'),
        error instanceof ShareImportError
          ? error.message
          : error instanceof Error
            ? error.message
            : t('alerts.import.importFailed'),
      );
    } finally {
      setIsImporting(false);
    }
  };

  if (!packageData) {
    return (
      <View style={styles.screen}>
        <HouseNavHeader
          title={t("import.title")}
          titleSize={Theme.navigation.secondaryTitleSize}
          showBack
          onBack={dismiss}
        />
        <HouseEmptyState
          title={t("import.noReviews")}
          description={t("import.noReviewsBody")}
          systemImage="square.and.arrow.down"
          androidImage="download"
        />
      </View>
    );
  }

  const rows: Array<
    | { kind: 'all' }
    | { kind: 'review'; review: ShareReviewBackup }
  > = [
    { kind: 'all' },
    ...packageData.reviews.map((review) => ({ kind: 'review' as const, review })),
  ];

  return (
    <View style={styles.screen}>
      <HouseNavHeader
        title={navigationTitle}
        titleSize={Theme.navigation.secondaryTitleSize}
        left={
          <HouseToolbarIconButton
            iosName="xmark"
            androidName="close"
            accessibilityLabel={t("common.cancel")}
            onPress={dismiss}
          />
        }
      />

      {packageData.reviews.length === 0 ? (
        <HouseEmptyState
          title={t("import.noReviews")}
          description={t("import.noReviewsBody")}
          systemImage="square.and.arrow.down"
          androidImage="download"
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item, index) =>
            item.kind === 'all' ? 'select-all' : item.review.id || String(index)
          }
          contentContainerStyle={{
            paddingBottom: 24 + insets.bottom,
            paddingTop: 8,
          }}
          renderItem={({ item }) => {
            if (item.kind === 'all') {
              return (
                <CheckboxRow
                  title={allSelected ? t('import.selectNone') : t('import.selectAll')}
                  isSelected={allSelected}
                  isBold
                  onPress={toggleSelectAll}
                />
              );
            }
            return (
              <CheckboxRow
                title={rowTitle(item.review)}
                subtitle={rowSubtitle(item.review)}
                isSelected={selectedIds.has(item.review.id)}
                onPress={() => toggle(item.review.id)}
              />
            );
          }}
        />
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          accessibilityRole="button"
          disabled={selectedIds.size === 0 || isImporting}
          onPress={() => void onImport()}
          style={({ pressed }) => [
            styles.importButton,
            (selectedIds.size === 0 || isImporting) && styles.importButtonDisabled,
            pressed && selectedIds.size > 0 && !isImporting && styles.pressed,
          ]}>
          {isImporting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.importLabel}>{t("common.import")}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function CheckboxRow({
  title,
  subtitle,
  isSelected,
  isBold,
  onPress,
}: {
  title: string;
  subtitle?: string;
  isSelected: boolean;
  isBold?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected }}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <SymbolView
        name={{
          ios: isSelected ? 'checkmark.square.fill' : 'square',
          android: isSelected ? 'check_box' : 'check_box_outline_blank',
          web: isSelected ? 'check_box' : 'check_box_outline_blank',
        }}
        tintColor={
          isSelected ? GustraColors.forestGreen : 'rgba(35, 32, 26, 0.35)'
        }
        size={22}
      />
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, isBold && styles.rowTitleBold]}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GustraColors.cream,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: GustraColors.cream,
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...bodyTextStyle,
    fontSize: 16,
    color: GustraColors.ink,
  },
  rowTitleBold: {
    fontWeight: '700',
  },
  rowSubtitle: {
    ...captionTextStyle,
    fontSize: 12,
    color: 'rgba(35, 32, 26, 0.55)',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: GustraColors.cream,
  },
  importButton: {
    backgroundColor: GustraColors.forestGreen,
    borderRadius: Theme.radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  importButtonDisabled: {
    backgroundColor: 'rgba(36, 78, 57, 0.4)',
  },
  importLabel: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
});
