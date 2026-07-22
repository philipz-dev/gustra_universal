import { useEffect, useMemo, useRef } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolView } from 'expo-symbols';
import Svg, { Path } from 'react-native-svg';

import { GustraColors } from '@/constants/Colors';
import { SERIF_FONT, Theme } from '@/constants/Theme';
import { Haptics } from '@/services/haptics';
import { RatingValue, ratingLabel } from '@/services/reviews/ratings';

const EMPTY_GOLD = 'rgba(217, 162, 39, 0.35)';
const STAR_PATH =
  'M12 2.2l2.55 6.2 6.7.55-5.1 4.45 1.55 6.5L12 16.3l-5.7 3.6 1.55-6.5-5.1-4.45 6.7-.55L12 2.2z';

const STAR_SIZE = Theme.size.starEdit;
const STAR_SPACING = 8;
const SCRUB_COMMIT_DISTANCE = 12;
const STARS_WIDTH = STAR_SIZE * 5 + STAR_SPACING * 4;

type InteractiveStarRatingProps = {
  /** Half-star steps 1–10, `0` unrated, `-1` N/A (Swift `RatingValue`). */
  rating: number;
  onChange: (rating: number) => void;
};

function StarIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={STAR_PATH} fill={color} />
    </Svg>
  );
}

function HalfStar({ size, fill }: { size: number; fill: number }) {
  return (
    <View style={{ width: size, height: size }}>
      <View style={styles.starBase}>
        <StarIcon size={size} color={EMPTY_GOLD} />
      </View>
      {fill > 0 ? (
        <View style={[styles.clip, { width: size * fill, height: size }]}>
          <StarIcon size={size} color={GustraColors.gold} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * Interactive half-star rating (Swift `StarRatingView`).
 * Tap or scrub horizontally; trash clears to N/A (`-1`).
 */
export function InteractiveStarRating({
  rating,
  onChange,
}: InteractiveStarRatingProps) {
  const isHorizontalScrub = useRef(false);
  const rowOffsetX = useRef(0);
  const lastSteps = useRef(rating);
  const startPageX = useRef(0);
  const startPageY = useRef(0);

  const displayRating = RatingValue.isStarRating(rating) ? rating : 0;

  useEffect(() => {
    lastSteps.current = rating;
  }, [rating]);

  useEffect(() => {
    Haptics.prepare();
  }, []);

  const stepsFromPageX = (pageX: number) => {
    const x = pageX - rowOffsetX.current;
    const pitch = STAR_SIZE + STAR_SPACING;
    const clampedX = Math.min(Math.max(x, 0), STARS_WIDTH);
    let index = Math.floor(clampedX / pitch);
    index = Math.min(index, 4);
    const localX = clampedX - index * pitch;
    const isHalf = localX < STAR_SIZE / 2;
    return Math.min(
      Math.max(index * 2 + (isHalf ? 1 : 2), 1),
      RatingValue.maxSteps,
    );
  };

  const applySteps = (steps: number) => {
    if (steps === lastSteps.current && RatingValue.isStarRating(rating)) return;
    lastSteps.current = steps;
    Haptics.selectionChanged();
    onChange(steps);
  };

  const handleGrant = (event: GestureResponderEvent) => {
    isHorizontalScrub.current = false;
    startPageX.current = event.nativeEvent.pageX;
    startPageY.current = event.nativeEvent.pageY;
    event.currentTarget.measureInWindow((x) => {
      rowOffsetX.current = x;
    });
  };

  const handleMove = (event: GestureResponderEvent) => {
    const { pageX, pageY } = event.nativeEvent;
    const dx = Math.abs(pageX - startPageX.current);
    const dy = Math.abs(pageY - startPageY.current);

    if (isHorizontalScrub.current) {
      applySteps(stepsFromPageX(pageX));
      return;
    }

    if (dx >= SCRUB_COMMIT_DISTANCE && dx > dy * 1.25) {
      isHorizontalScrub.current = true;
      applySteps(stepsFromPageX(pageX));
    }
  };

  const handleRelease = (event: GestureResponderEvent) => {
    const { pageX, pageY } = event.nativeEvent;
    const dx = Math.abs(pageX - startPageX.current);
    const dy = Math.abs(pageY - startPageY.current);
    const wasScrub = isHorizontalScrub.current;
    isHorizontalScrub.current = false;

    if (wasScrub) {
      applySteps(stepsFromPageX(pageX));
      return;
    }

    if (dx < SCRUB_COMMIT_DISTANCE && dy < SCRUB_COMMIT_DISTANCE) {
      applySteps(stepsFromPageX(pageX));
    }
  };

  const starFills = useMemo(
    () =>
      Array.from({ length: 5 }, (_, index) =>
        RatingValue.fillForStar(index + 1, displayRating),
      ),
    [displayRating],
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View
          style={[styles.stars, { width: STARS_WIDTH, height: STAR_SIZE }]}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={handleGrant}
          onResponderMove={handleMove}
          onResponderRelease={handleRelease}
          onResponderTerminate={() => {
            isHorizontalScrub.current = false;
          }}
          accessibilityRole="adjustable"
          accessibilityLabel="Rating"
          accessibilityValue={{
            text: RatingValue.isStarRating(rating)
              ? RatingValue.starValue(rating).toFixed(1)
              : 'Not rated',
          }}>
          {starFills.map((fill, index) => (
            <View
              key={index}
              style={{
                width: STAR_SIZE,
                height: STAR_SIZE,
                marginRight: index < 4 ? STAR_SPACING : 0,
              }}>
              <HalfStar size={STAR_SIZE} fill={fill} />
            </View>
          ))}
        </View>

        {RatingValue.isStarRating(rating) ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear rating"
            hitSlop={8}
            onPress={() => {
              lastSteps.current = RatingValue.notApplicable;
              Haptics.light();
              onChange(RatingValue.notApplicable);
            }}
            style={({ pressed }) => [
              styles.clearHit,
              pressed && styles.pressed,
            ]}>
            {Platform.OS === 'ios' ? (
              <SymbolView
                name="trash"
                size={18}
                tintColor="rgba(35, 32, 26, 0.45)"
                weight="semibold"
              />
            ) : (
              <MaterialIcons
                name="delete-outline"
                size={20}
                color="rgba(35, 32, 26, 0.45)"
              />
            )}
          </Pressable>
        ) : (
          <View style={styles.clearHit} />
        )}
      </View>

      {RatingValue.isStarRating(rating) ? (
        <Text style={styles.label}>{ratingLabel(rating)}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starBase: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  clip: {
    overflow: 'hidden',
  },
  clearHit: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.65,
  },
  label: {
    fontFamily: SERIF_FONT,
    fontSize: 15,
    color: 'rgba(35, 32, 26, 0.7)',
  },
});
