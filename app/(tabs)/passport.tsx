import { useMemo } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryAverageRow } from '@/components/passport/CategoryAverageRow';
import { PassportSection } from '@/components/passport/PassportSection';
import { PassportStatRow } from '@/components/passport/PassportStatRow';
import { HouseEmptyState } from '@/components/ui/HouseEmptyState';
import { SerifText } from '@/components/ui/SerifText';
import { GustraColors } from '@/constants/Colors';
import { Theme } from '@/constants/Theme';
import { useCriteriaSettings } from '@/context/CriteriaSettings';
import { usePassportDisplaySettings } from '@/context/PassportDisplaySettings';
import { getPassportStats } from '@/data/passportStats';

export default function CulinaryPassportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { categoryAveragesStyle } = usePassportDisplaySettings();
  const { enabledCriteria } = useCriteriaSettings();
  const stats = useMemo(
    () => getPassportStats(enabledCriteria),
    [enabledCriteria],
  );



  if (stats.totalReviews === 0) {
    return (
      <View style={[styles.screen, styles.emptyPad]}>
        <HouseEmptyState
          title="No Reviews Yet"
          description="Add your first restaurant review to build your culinary passport."
          systemImage="chart.bar.doc.horizontal"
          androidImage="bar_chart"
          actionTitle="Add Review"
          onAction={() =>
            Alert.alert('Add review', 'Coming soon in a later pass.')
          }
        />
      </View>
    );
  }

  const bestTitle =
    stats.bestRestaurants.length === 1 ? 'Best Restaurant' : 'Best Restaurants';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          paddingBottom:
            Theme.spacing.floatingTabBarClearance + insets.bottom + 24,
        },
      ]}
      overScrollMode="never"
      showsVerticalScrollIndicator={false}>

      <PassportSection title="Overview">
        <PassportStatRow
          title="Total Reviews"
          value={`${stats.totalReviews}`}
        />
        <PassportStatRow
          title="Average Overall"
          value={`${stats.averageOverall.toFixed(1)}/5`}
        />
      </PassportSection>

      {stats.bestRestaurants.length > 0 && stats.bestScore != null ? (
        <PassportSection
          title={bestTitle}
          trailing={`${stats.bestScore.toFixed(1)}/5`}>
          {stats.bestRestaurants.map((entry) => (
            <Pressable
              key={entry.restaurantId}
              accessibilityRole="button"
              onPress={() => router.push(`/review/${entry.reviewId}`)}
              style={({ pressed }) => [
                styles.linkRow,
                pressed && styles.linkPressed,
              ]}>
              <SerifText size={17} weight="semibold" style={styles.linkText}>
                {entry.title}
              </SerifText>
            </Pressable>
          ))}
        </PassportSection>
      ) : null}

      {stats.criterionAverages.length > 0 ? (
        <PassportSection title="Category Averages">
          {stats.criterionAverages.map((row) => (
            <CategoryAverageRow
              key={row.id}
              title={row.title}
              average={row.average}
              style={categoryAveragesStyle}
            />
          ))}

        </PassportSection>
      ) : null}

      <PassportSection title="City Averages">
        {stats.cityAverages.length === 0 ? (
          <View style={styles.mutedRow}>
            <Text style={styles.muted}>No city data yet.</Text>
          </View>
        ) : (
          stats.cityAverages.map((row) => (
            <PassportStatRow
              key={row.city}
              title={row.city}
              value={`${row.average.toFixed(1)}/5`}
            />
          ))
        )}
      </PassportSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GustraColors.cream,
  },
  emptyPad: {
    paddingBottom: 96,
  },
  content: {
    paddingHorizontal: Theme.spacing.listRowHorizontal,
    paddingTop: 16,
    gap: 22,
  },
  linkRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(236, 227, 207, 0.45)',
    borderRadius: 12,
  },
  linkPressed: {
    opacity: 0.85,
  },
  linkText: {
    color: GustraColors.forestGreen,
  },
  mutedRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(236, 227, 207, 0.45)',
    borderRadius: 12,
  },
  muted: {
    fontSize: 16,
    color: 'rgba(35, 32, 26, 0.55)',
  },
});
