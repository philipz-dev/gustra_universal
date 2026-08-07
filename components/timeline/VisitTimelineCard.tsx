import { useEffect, useState, type ReactNode } from 'react';
import {
  ImageBackground,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { FeedSwipeDelete } from '@/components/feed/FeedSwipeDelete';
import { SerifText } from '@/components/ui/SerifText';
import { GustraColors } from '@/constants/Colors';
import { bodyTextStyle, captionTextStyle } from '@/constants/Theme';
import { formatLongDate } from '@/i18n/formatDates';
import { formatScoreOutOfFive } from '@/services/reviews/ratings';

/** A visit entry — same shape as the Time Travel entries. */
export type VisitTimelineEntry = {
  reviewId: string;
  restaurantId: string;
  restaurantTitle: string;
  date: string;
  score: number;
  photoUrl: string;
  thumbnailColor: string;
};

/** Platform-adaptive glyph (SF Symbol on iOS, Material on Android). */
export function HouseGlyph({
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

/**
 * A timeline marker that scales in gently when it mounts (Apple-style reveal).
 * Pure spring pop — no scroll-driven/parallax motion (deliberately minimal).
 */
export function MountNode({
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

/**
 * Compact no-photo card in house-style green (same for every restaurant — the
 * per-restaurant thumbnail color can be brown/amber and would clash with the
 * green/gold palette). The star badge sits in the bottom-right corner
 * (identical to the photo cards) via the shared `scoreBadge`; right padding
 * keeps the fully-expanded restaurant name clear of it. No fixed height — the
 * card wraps exactly its text content, so short names stay compact.
 */
export function StoryFallbackCard({
  entry,
  hideRestaurantTitle = false,
}: {
  entry: VisitTimelineEntry;
  hideRestaurantTitle?: boolean;
}) {
  return (
    <View style={[styles.storyFallback, styles.storyFallbackGreen]}>
      <View
        style={[
          styles.storyFallbackText,
          hideRestaurantTitle && styles.storyFallbackTextTitleless,
        ]}>
        {!hideRestaurantTitle ? (
          <SerifText size={24} weight="bold" style={styles.storyTitle}>
            {entry.restaurantTitle}
          </SerifText>
        ) : null}
        <Text
          style={[
            styles.storyDate,
            hideRestaurantTitle && styles.storyFallbackDateTitleless,
          ]}>
          {formatLongDate(entry.date)}
        </Text>
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
export function StoryOverlay({
  entry,
  hideRestaurantTitle = false,
}: {
  entry: VisitTimelineEntry;
  hideRestaurantTitle?: boolean;
}) {
  return (
    <View
      style={[
        styles.storyCopy,
        hideRestaurantTitle && styles.storyCopyTitleless,
      ]}>
      {!hideRestaurantTitle ? (
        <SerifText size={24} weight="bold" style={styles.storyTitle}>
          {entry.restaurantTitle}
        </SerifText>
      ) : null}
      <View style={styles.storyMetaRow}>
        <Text
          style={[
            styles.storyDate,
            hideRestaurantTitle && styles.storyDateTitleless,
          ]}>
          {formatLongDate(entry.date)}
        </Text>
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

/**
 * One visit on a timeline: a large cinematic photo card (~340pt) with the
 * restaurant info overlaid on a bottom gradient, and the rating in a floating
 * glassmorphism badge at the bottom-right. Without a photo it falls back to a
 * compact card in house-style green that wraps the text (no fixed height —
 * the frame is as tall as the content).
 *
 * `onPress` opens the review detail. `onDelete` (optional) wraps the card in
 * the Mail-style swipe-to-delete row.
 */
export function VisitTimelineCard({
  entry,
  onPress,
  onDelete,
  hideRestaurantTitle = false,
}: {
  entry: VisitTimelineEntry;
  onPress: () => void;
  onDelete?: () => void;
  hideRestaurantTitle?: boolean;
}) {
  const [photoFailed, setPhotoFailed] = useState(false);
  // A non-empty uri that fails to load (e.g. an orphaned local path after a
  // restore) must not render as a broken 340pt photo card — fall back to the
  // compact restaurant-colored tile instead.
  const hasPhoto = Boolean(entry.photoUrl) && !photoFailed;
  const accessibilityLabel = `${entry.restaurantTitle}, ${formatLongDate(
    entry.date,
  )}, ${formatScoreOutOfFive(entry.score)}`;

  const card = (
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
          resizeMode="cover"
          onError={() => setPhotoFailed(true)}>
          <LinearGradient
            colors={[
              'rgba(10, 8, 4, 0)',
              'rgba(10, 8, 4, 0.28)',
              'rgba(10, 8, 4, 0.9)',
            ]}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
          />
          <StoryOverlay entry={entry} hideRestaurantTitle={hideRestaurantTitle} />
        </ImageBackground>
      ) : (
        <StoryFallbackCard
          entry={entry}
          hideRestaurantTitle={hideRestaurantTitle}
        />
      )}
    </Pressable>
  );

  if (!onDelete) {
    return (
      <View style={styles.timelineRow}>
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
        {card}
      </View>
    );
  }

  return (
    <View style={styles.timelineRow}>
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
      <View style={styles.swipeWrap}>
        <FeedSwipeDelete
          id={`visit_${entry.reviewId}`}
          onDelete={onDelete}
          cornerRadius={26}>
          {card}
        </FeedSwipeDelete>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /* ——— Timeline layout ——— */
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  swipeWrap: {
    flex: 1,
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
    position: 'relative',
    paddingTop: 18,
    paddingBottom: 18,
    paddingLeft: 18,
    borderRadius: 26,
    overflow: 'hidden',
  },
  /** House-style green fallback tile for visits without a photo. */
  storyFallbackGreen: {
    backgroundColor: GustraColors.forestGreen,
  },
  storyFallbackText: {
    // Keep the fully-expanded name clear of the badge zone on the right edge.
    paddingRight: 92,
    gap: 6,
  },
  /** Titleless fallback: the date is the only line — drop the extra right pad. */
  storyFallbackTextTitleless: {
    paddingRight: 92,
  },
  storyFallbackDateTitleless: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  storyCopy: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingLeft: 18,
    // Reserve the right edge past the floating star badge so a long restaurant
    // name wraps before it and never runs under/into the rating label.
    paddingRight: 120,
    paddingBottom: 16,
    paddingTop: 48,
    gap: 4,
  },
  /** Without the restaurant title the date is the only copy — bump it up. */
  storyCopyTitleless: {
    paddingTop: 12,
    paddingRight: 120,
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
  /** Titleless overlay: the date is the primary line — make it larger. */
  storyDateTitleless: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
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
});
