import { useEffect, useMemo, type ReactNode } from 'react';
import {
  ImageBackground,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withDelay,
} from 'react-native-reanimated';

import { PassportSection } from '@/components/passport/PassportSection';
import { AnimatedCounter } from '@/components/passport/AnimatedCounter';
import { SerifText } from '@/components/ui/SerifText';
import { HouseNavHeader } from '@/components/ui/HouseNavHeader';
import { HouseEmptyState } from '@/components/ui/HouseEmptyState';
import { GustraColors } from '@/constants/Colors';
import { Theme, serifStyle, bodyTextStyle, captionTextStyle } from '@/constants/Theme';
import { useReviewsStore } from '@/context/ReviewsStore';
import { buildTimeMachineEntries, type TimeMachineEntry } from '@/data/timeMachine';
import { getTimeTravelStats } from '@/data/passportStats';
import { activeIntlLocale, formatLongDate } from '@/i18n/formatDates';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { formatScoreOutOfFive } from '@/services/reviews/ratings';
import { HouseErrorBoundary } from '@/components/ui/HouseErrorBoundary';

type GroupedMonth = {
  key: string;
  label: string;
  entries: ReturnType<typeof buildTimeMachineEntries>;
};

/** Group a (newest-first) entry list into year → month buckets. */
function groupByYearAndMonth(
  entries: ReturnType<typeof buildTimeMachineEntries>,
): { year: number; months: GroupedMonth[] }[] {
  const locale = activeIntlLocale();
  const years: { year: number; months: GroupedMonth[] }[] = [];
  for (const entry of entries) {
    const date = new Date(entry.date);
    if (!Number.isFinite(date.getTime())) continue;
    const year = date.getFullYear();
    const month = date.getMonth();
    let yearGroup = years.find((y) => y.year === year);
    if (!yearGroup) {
      yearGroup = { year, months: [] };
      years.push(yearGroup);
    }
    let monthGroup = yearGroup.months.find((m) => m.key === `${year}-${month}`);
    if (!monthGroup) {
      monthGroup = {
        key: `${year}-${month}`,
        label: date.toLocaleString(locale, { month: 'long' }),
        entries: [],
      };
      yearGroup.months.push(monthGroup);
    }
    monthGroup.entries.push(entry);
  }
  return years;
}

/** Platform-adaptive glyph (SF Symbol on iOS, Material on Android). */
function HouseGlyph({
  ios,
  android,
  color,
  size = 22,
}: {
  ios: SFSymbol;
  android: keyof typeof MaterialIcons.glyphMap;
  color: string;
  size?: number;
}) {
  if (Platform.OS === 'ios') {
    return (
      <SymbolView name={ios} tintColor={color} size={size} weight="semibold" />
    );
  }
  return <MaterialIcons name={android} size={size} color={color} />;
}

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

/**
 * A timeline marker that scales in gently when it mounts (Apple-style reveal).
 * Pure spring pop — no scroll-driven/parallax motion (deliberately minimal).
 */
function MountNode({
  children,
  delay = 0,
  style,
}: {
  children?: ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const scale = useSharedValue(0.55);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 14, stiffness: 200 });
    opacity.value = withDelay(delay, withTiming(1, { duration: 260 }));
  }, [scale, opacity, delay]);

  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[style, animated]}>{children}</Animated.View>
  );
}

/** One visit on the timeline: a large cinematic photo card (~340pt) with the
 * restaurant info overlaid on a bottom gradient, and the rating in a floating
 * glassmorphism badge at the bottom-right. Without a photo it falls back to a
 * compact card in the restaurant `thumbnailColor` that wraps the text (no
 * fixed height — the frame is as tall as the content).
 */
function EntryTimelineRow({
  entry,
  onPress,
}: {
  entry: TimeMachineEntry;
  onPress: () => void;
}) {
  const hasPhoto = Boolean(entry.photoUrl);
  const accessibilityLabel = `${entry.restaurantTitle}, ${formatLongDate(
    entry.date,
  )}, ${formatScoreOutOfFive(entry.score)}`;

  return (
    <View style={styles.timelineRow}>
      {/* Rail with an animated node sitting on the timeline line. */}
      <View style={styles.rail}>
        <MountNode style={styles.railNodeShell}>
          <View style={styles.railNode}>
            <HouseGlyph
              ios="circle.fill"
              android="circle"
              color={GustraColors.gold}
              size={9}
            />
          </View>
        </MountNode>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [
          hasPhoto ? styles.storyCard : styles.storyCardNoPhoto,
          pressed && styles.storyPressed,
        ]}>
        {hasPhoto ? (
          <ImageBackground
            source={{ uri: entry.photoUrl }}
            style={styles.storyBg}
            imageStyle={styles.storyImg}
            resizeMode="cover">
            <LinearGradient
              colors={[
                'rgba(10, 8, 4, 0)',
                'rgba(10, 8, 4, 0.28)',
                'rgba(10, 8, 4, 0.9)',
              ]}
              locations={[0, 0.45, 1]}
              style={StyleSheet.absoluteFill}
            />
            <StoryOverlay entry={entry} />
          </ImageBackground>
        ) : (
          <StoryFallbackCard entry={entry} />
        )}
      </Pressable>
    </View>
  );
}

/** Compact no-photo card: restaurant-tinted background, the height wraps the
 * text (title + date + score badge) instead of a fixed empty box. */
function StoryFallbackCard({ entry }: { entry: TimeMachineEntry }) {
  return (
    <View
      style={[
        styles.storyFallback,
        { backgroundColor: entry.thumbnailColor },
      ]}>
      <View style={styles.storyFallbackCopy}>
        <SerifText
          size={24}
          weight="bold"
          style={styles.storyTitle}
          numberOfLines={2}>
          {entry.restaurantTitle}
        </SerifText>
        <View style={styles.storyMetaRow}>
          <Text style={styles.storyDate}>{formatLongDate(entry.date)}</Text>
        </View>
      </View>
      <View style={styles.scoreBadge} pointerEvents="none">
        <HouseGlyph
          ios="star.fill"
          android="star"
          color={GustraColors.gold}
          size={13}
        />
        <Text style={styles.scoreBadgeText}>
          {formatScoreOutOfFive(entry.score)}
        </Text>
      </View>
    </View>
  );
}

/** Bottom-overlay copy block sitting on the cinematic gradient. */
function StoryOverlay({ entry }: { entry: TimeMachineEntry }) {
  return (
    <View style={styles.storyCopy}>
      <SerifText
        size={24}
        weight="bold"
        style={styles.storyTitle}
        numberOfLines={2}>
        {entry.restaurantTitle}
      </SerifText>
      <View style={styles.storyMetaRow}>
        <Text style={styles.storyDate}>{formatLongDate(entry.date)}</Text>
      </View>

      {/* Floating glassmorphism rating badge, bottom-right. */}
      <View style={styles.scoreBadge} pointerEvents="none">
        <HouseGlyph
          ios="star.fill"
          android="star"
          color={GustraColors.gold}
          size={13}
        />
        <Text style={styles.scoreBadgeText}>
          {formatScoreOutOfFive(entry.score)}
        </Text>
      </View>
    </View>
  );
}

/** Large serif year header, centered on the timeline (Apple tilt). */
function YearHeader({ year, count }: { year: number; count: number }) {
  const { t } = useAppTranslation();
  return (
    <View style={styles.yearHeaderRow}>
      <View style={styles.yearHeaderRule} />
      <MountNode style={styles.yearHeaderChip}>
        <SerifText size={28} weight="bold" style={styles.yearHeaderText}>
          {year}
        </SerifText>
      </MountNode>
      <View style={styles.yearHeaderRule} />
      <Text style={styles.yearCount}>{count}</Text>
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
  const yearGroups = useMemo(() => groupByYearAndMonth(entries), [entries]);

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
            <View style={styles.timeline}>
              {yearGroups.map((yearGroup) => {
                const entriesInYear = yearGroup.months.reduce(
                  (sum, m) => sum + m.entries.length,
                  0,
                );
                return (
                  <View key={yearGroup.year} style={styles.yearBlock}>
                    <YearHeader year={yearGroup.year} count={entriesInYear} />

                    <View style={styles.yearSpineTrack}>
                      <View style={styles.yearSpineLine} />
                      {yearGroup.months.map((month) => {
                        if (month.entries.length === 0) return null;
                        return (
                          <View key={month.key} style={styles.monthGroup}>
                            <View style={styles.monthRow}>
                              <View style={styles.rail}>
                                <MountNode delay={90} style={styles.monthMarker}>
                                  <View style={styles.monthMarkerInner} />
                                </MountNode>
                              </View>
                              <Text style={styles.monthTitle}>
                                {t('passport.timeTravelMonthHeader', {
                                  month: month.label,
                                  year: yearGroup.year,
                                })}
                              </Text>
                              <Text style={styles.monthCount}>
                                {t('passport.timeTravelMonthCount', {
                                  count: month.entries.length,
                                })}
                              </Text>
                            </View>

                            {month.entries.map((entry) => (
                              <EntryTimelineRow
                                key={entry.reviewId}
                                entry={entry}
                                onPress={() =>
                                  router.push(
                                    `/passport/review/${entry.reviewId}`,
                                  )
                                }
                              />
                            ))}
                          </View>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}

        <View
          pointerEvents="none"
          style={[
            styles.bottomSolid,
            { height: Theme.spacing.floatingTabBarClearance + insets.bottom },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.bottomFade,
            { bottom: Theme.spacing.floatingTabBarClearance + insets.bottom },
          ]}>
          <LinearGradient
            colors={['rgba(245, 240, 225, 0)', GustraColors.cream]}
            style={StyleSheet.absoluteFill}
          />
        </View>
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

  /* ——— Year header (large serif, centered) ——— */
  yearHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 8,
  },
  yearHeaderRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(217, 162, 39, 0.35)',
  },
  yearHeaderChip: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 4,
  },
  yearHeaderText: {
    color: GustraColors.forestGreen,
    fontVariant: ['tabular-nums'],
  },
  yearCount: {
    ...captionTextStyle,
    fontSize: 13,
    color: 'rgba(35, 32, 26, 0.5)',
    fontVariant: ['tabular-nums'],
  },

  /* ——— Timeline layout ——— */
  timeline: {
    gap: 10,
  },
  yearBlock: {
    gap: 14,
    paddingBottom: 12,
  },
  yearSpineTrack: {
    position: 'relative',
  },
  /** Single continuous 3px vertical line, centered on the rail. */
  yearSpineLine: {
    position: 'absolute',
    left: 27,
    top: 0,
    bottom: 0,
    width: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(217, 162, 39, 0.25)',
  },
  monthGroup: {
    gap: 14,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
    marginBottom: 6,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(35, 32, 26, 0.08)',
  },
  monthTitle: {
    ...captionTextStyle,
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(35, 32, 26, 0.55)',
  },
  monthCount: {
    ...captionTextStyle,
    fontSize: 12,
    color: 'rgba(217, 162, 39, 1)',
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  monthMarker: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 18,
    height: 18,
    zIndex: 2,
  },
  monthMarkerInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: GustraColors.gold,
    borderWidth: 2,
    borderColor: GustraColors.cream,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },

  /* ——— Visit rows ——— */
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  /** Fixed-width rail column; markers/thumbnails live here, centered on line. */
  rail: {
    width: 56,
    alignItems: 'center',
  },
  railNodeShell: {
    width: 28,
    height: 28,
    marginTop: 18,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  railNode: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: GustraColors.cream,
    borderWidth: 2,
    borderColor: 'rgba(217, 162, 39, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  /* ——— Cinematic story card (~340pt) ——— */
  storyCard: {
    flex: 1,
    height: 340,
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(35, 32, 26, 0.1)',
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
    marginBottom: 6,
  },
  /** No-photo variant: no fixed height — the card wraps its text content. */
  storyCardNoPhoto: {
    flex: 1,
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(35, 32, 26, 0.1)',
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
    marginBottom: 6,
  },
  storyPressed: {
    opacity: 0.94,
  },
  storyBg: {
    flex: 1,
  },
  storyImg: {
    borderRadius: 26,
  },
  storyFallback: {
    minHeight: 96,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  storyFallbackCopy: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    paddingRight: 88,
    gap: 4,
  },
  storyCopy: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingBottom: 16,
    paddingTop: 48,
    gap: 4,
  },
  storyTitle: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  storyMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  storyDate: {
    ...captionTextStyle,
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 253, 245, 0.92)',
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  /** Floating glassmorphism rating badge, bottom-right. */
  scoreBadge: {
    position: 'absolute',
    right: 18,
    bottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  scoreBadgeText: {
    ...bodyTextStyle,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },

  bottomSolid: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: GustraColors.cream,
  },
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: Theme.size.fab + 24,
  },
});
