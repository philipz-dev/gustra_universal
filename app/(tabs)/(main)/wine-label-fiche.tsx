import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WineLabelFicheView } from '@/components/wine/WineLabelFicheView';
import { HouseEmptyState } from '@/components/ui/HouseEmptyState';
import { HouseNavHeader } from '@/components/ui/HouseNavHeader';
import { GustraColors } from '@/constants/Colors';
import { Theme } from '@/constants/Theme';
import { useReviewsStore } from '@/context/ReviewsStore';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { hasWineLabelMatch } from '@/services/wine/wineLabelTypes';

/**
 * Full wine fiche from a saved review (Gemini Vision result).
 */
export default function WineLabelFicheScreen() {
  const { t } = useAppTranslation();
  const { reviewId } = useLocalSearchParams<{ reviewId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getReview } = useReviewsStore();
  const review = getReview(reviewId);
  const fiche = review?.wineLabel;
  const bottomPad =
    Theme.spacing.floatingTabBarClearance + insets.bottom + 24;

  return (
    <View style={styles.screen}>
      <HouseNavHeader
        title={t('wineScan.fiche.title')}
        showBack
        onBack={() => router.back()}
      />
      {!hasWineLabelMatch(fiche) ? (
        <HouseEmptyState
          title={t('wineScan.noMatchTitle')}
          description={t('wineScan.noMatchBody')}
        />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.pad, { paddingBottom: bottomPad }]}
          overScrollMode="never">
          <WineLabelFicheView fiche={fiche} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GustraColors.cream,
  },
  pad: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
});
