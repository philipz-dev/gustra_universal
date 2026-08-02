import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SFSymbol } from 'expo-symbols';

import { PassportSection } from '@/components/passport/PassportSection';
import { AnimatedCounter } from '@/components/passport/AnimatedCounter';
import { SerifText } from '@/components/ui/SerifText';
import { HouseNavHeader } from '@/components/ui/HouseNavHeader';
import { HouseEmptyState } from '@/components/ui/HouseEmptyState';
import { TabBarBottomFade } from '@/components/ui/TabBarBottomFade';
import { HouseGlyph } from '@/components/timeline/VisitTimelineCard';
import { VisitTimeline } from '@/components/timeline/VisitTimeline';import { GustraColors } from '@/constants/Colors';
import { Theme, serifStyle, captionTextStyle } from '@/constants/Theme';
import { useReviewsStore } from '@/context/ReviewsStore';
import { buildTimeMachineEntries } from '@/data/timeMachine';
import { getTimeTravelStats } from '@/data/passportStats';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { HouseErrorBoundary } from '@/components/ui/HouseErrorBoundary';

/** One elegant stat card: icon medallion + animated counter + caption. */
function StatCard({
  ios,
  android,
  value,
  decimals = 0,
  label,
  accent = false,
}: {
  ios: SFSymbol;
  android: keyof typeof MaterialIcons.glyphMap;
  value: number;
  decimals?: number;
  label: string;
  /** Render the number in gold (used for the average rating). */
  accent?: boolean;
}) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statIcon}>
        <HouseGlyph
          ios={ios}
          android={android}
          color={GustraColors.gold}
          size={22}
        />
      </View>
      <AnimatedCounter
        value={value}
        decimals={decimals}
        style={[styles.statValue, accent && styles.statValueAccent]}
      />
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function TimeMachineScreen() {
  const { t } = useAppTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { reviews, restaurants, ready } = useReviewsStore();

  const entries = useMemo(
    () => buildTimeMachineEntries(reviews, restaurants),
    [reviews, restaurants],
  );
  const stats = useMemo(() => getTimeTravelStats(entries), [entries]);

  return (
    <HouseErrorBoundary
      fallbackTitle={t('passport.timeTravel') || 'Time Travel'}
      fallbackMessage="We konden je tijdlijn op dit moment niet laden. Probeer het scherm opnieuw te openen."
    >
      <View style={styles.screen}>
        <HouseNavHeader
          title={t('passport.timeTravel')}
          titleSize={Theme.navigation.secondaryTitleSize}
          showBack
          onBack={() => router.back()}
        />

        {!ready || entries.length === 0 ? (
          <View style={styles.emptyPad}>
            <HouseEmptyState
              title={t('passport.timeTravelEmptyTitle')}
              description={t('passport.timeTravelEmptyBody')}
              systemImage="clock.arrow.circlepath"
              androidImage="history"
            />
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.content,
              {
                paddingBottom:
                  Theme.spacing.floatingTabBarClearance + insets.bottom + 24,
              },
            ]}
            overScrollMode="never"
            showsVerticalScrollIndicator={false}>
            {/* ——— Stats trio ——— */}
            <PassportSection title={t('passport.overview')}>
              <View style={styles.statsRow}>
                <StatCard
                  ios="tray.full"
                  android="collections-bookmark"
                  value={stats.totalAllTime}
                  label={t('passport.timeTravelTotal')}
                />
                <StatCard
                  ios="star.fill"
                  android="star"
                  value={stats.averageAllTime}
                  decimals={1}
                  label={t('passport.timeTravelAverage')}
                  accent
                />
                <StatCard
                  ios="calendar"
                  android="calendar-month"
                  value={stats.years.length}
                  label={t('passport.timeTravelYears')}
                />
              </View>
            </PassportSection>

            {/* ——— Timeline ——— */}
            <VisitTimeline
              entries={entries}
              onPressEntry={(entry) =>
                router.push(`/passport/review/${entry.reviewId}`)
              }
            />
          </ScrollView>
        )}

        <TabBarBottomFade />
      </View>
    </HouseErrorBoundary>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GustraColors.cream,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Theme.spacing.listRowHorizontal,
    paddingTop: 24,
    gap: Theme.list.sectionGap,
  },
  emptyPad: {
    flex: 1,
    paddingHorizontal: Theme.spacing.listRowHorizontal,
  },

  /* ——— Stats trio ——— */
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 20,
    paddingHorizontal: 8,
    borderRadius: 24,
    backgroundColor: 'rgba(240, 233, 214, 0.62)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(35, 32, 26, 0.08)',
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  statIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(217, 162, 39, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    ...serifStyle(26, 'bold'),
    color: GustraColors.forestGreen,
    fontVariant: ['tabular-nums'],
  },
  statValueAccent: {
    color: GustraColors.gold,
  },
  statLabel: {
    ...captionTextStyle,
    fontSize: 12,
    color: 'rgba(35, 32, 26, 0.55)',
    textAlign: 'center',
  },
});
