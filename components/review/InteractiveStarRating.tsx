import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolView } from 'expo-symbols';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { GustraColors } from '@/constants/Colors';
import { SERIF_FONT, Theme } from '@/constants/Theme';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { Haptics } from '@/services/haptics';
import { RatingValue, ratingLabel } from '@/services/reviews/ratings';

const EMPTY_GOLD = 'rgba(217, 162, 39, 0.35)';
const STAR_PATH =
  'M12 2.2l2.55 6.2 6.7.55-5.1 4.45 1.55 6.5L12 16.3l-5.7 3.6 1.55-6.5-5.1-4.45 6.7-.55L12 2.2z';

const STAR_SIZE = Theme.size.starEdit;
const STAR_SPACING = 8;
/** Horizontal move before scrub activates (ScrollView / stack keep vertical). */
const ACTIVE_OFFSET_X = 8;
/** Vertical move cancels scrub so the form can scroll (Swift StarRatingView). */
const FAIL_OFFSET_Y = 14;
const STARS_WIDTH = STAR_SIZE * 5 + STAR_SPACING * 4;

type InteractiveStarRatingProps = {
  /** Half-star steps 1–10, `0` unrated, `-1` N/A (Swift `RatingValue`). */
  rating: number;
  onChange: (rating: number) => void;
  /** True while horizontal scrub is active — parent should lock ScrollView. */
  onScrubbingChange?: (scrubbing: boolean) => void;
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

function stepsFromLocalX(x: number): number {
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
}

/**
 * Interactive half-star rating (Swift `StarRatingView`).
 * Tap or horizontal scrub; vertical movement fails to ScrollView.
 * Trash clears to N/A (`-1`).
 */
export function InteractiveStarRating({
  rating,
  onChange,
  onScrubbingChange,
}: InteractiveStarRatingProps) {
  const { t } = useAppTranslation();
  const lastSteps = useRef(rating);
  const scrubbingRef = useRef(false);
  const ratingRef = useRef(rating);
  ratingRef.current = rating;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onScrubbingChangeRef = useRef(onScrubbingChange);
  onScrubbingChangeRef.current = onScrubbingChange;

  const displayRating = RatingValue.isStarRating(rating) ? rating : 0;

  useEffect(() => {
    lastSteps.current = rating;
  }, [rating]);

  useEffect(() => {
    Haptics.prepare();
  }, []);

  const applyFromX = useCallback((x: number) => {
    const steps = stepsFromLocalX(x);
    if (
      steps === lastSteps.current &&
      RatingValue.isStarRating(ratingRef.current)
    ) {
      return;
    }
    lastSteps.current = steps;
    Haptics.selectionChanged();
    onChangeRef.current(steps);
  }, []);

  const setScrubbing = useCallback((active: boolean) => {
    if (scrubbingRef.current === active) return;
    scrubbingRef.current = active;
    onScrubbingChangeRef.current?.(active);
  }, []);

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .activeOffsetX([-ACTIVE_OFFSET_X, ACTIVE_OFFSET_X])
      .failOffsetY([-FAIL_OFFSET_Y, FAIL_OFFSET_Y])
      .onStart(() => {
        runOnJS(setScrubbing)(true);
      })
      .onUpdate((e) => {
        runOnJS(applyFromX)(e.x);
      })
      .onFinalize(() => {
        runOnJS(setScrubbing)(false);
      });

    const tap = Gesture.Tap().onEnd((e) => {
      runOnJS(applyFromX)(e.x);
    });

    // Pan wins once horizontal intent is clear; otherwise tap rates.
    // Vertical drags fail the pan so ScrollView can scroll.
    return Gesture.Exclusive(pan, tap);
  }, [applyFromX, setScrubbing]);

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
        <GestureDetector gesture={gesture}>
          <View
            style={[styles.stars, { width: STARS_WIDTH, height: STAR_SIZE }]}
            accessibilityRole="adjustable"
            accessibilityLabel={t('rating.a11y.rating')}
            accessibilityValue={{
              text: RatingValue.isStarRating(rating)
                ? RatingValue.starValue(rating).toFixed(1)
                : t('rating.labels.notRated'),
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
        </GestureDetector>

        {RatingValue.isStarRating(rating) ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('rating.a11y.clear')}
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
