import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { GustraColors } from '@/constants/Colors';
import { SERIF_FONT } from '@/constants/Theme';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { RatingValue, ratingLabel } from '@/services/reviews/ratings';

/**
 * Rounded 5-point star path in a 24×24 viewBox (SF Symbol–like proportions).
 */
const STAR_PATH =
  'M12 2.2l2.55 6.2 6.7.55-5.1 4.45 1.55 6.5L12 16.3l-5.7 3.6 1.55-6.5-5.1-4.45 6.7-.55L12 2.2z';

/** Stroke width in viewBox units for empty (outline) stars. */
const OUTLINE_STROKE = 1.6;

type StarIconProps = {
  size: number;
  color: string;
  /** Stroke-only star (empty state). */
  outlined?: boolean;
};

function StarIcon({ size, color, outlined = false }: StarIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={STAR_PATH}
        fill={outlined ? 'none' : color}
        stroke={outlined ? color : undefined}
        strokeWidth={outlined ? OUTLINE_STROKE : undefined}
        strokeLinejoin={outlined ? 'round' : undefined}
        strokeLinecap={outlined ? 'round' : undefined}
      />
    </Svg>
  );
}

function FractionalStar({ fill, size }: { fill: number; size: number }) {
  return (
    <View style={{ width: size, height: size }}>
      <View style={styles.starBase}>
        <StarIcon size={size} color={GustraColors.gold} outlined />
      </View>
      {fill > 0 ? (
        <View style={[styles.clip, { width: size * fill, height: size }]}>
          <StarIcon size={size} color={GustraColors.gold} />
        </View>
      ) : null}
    </View>
  );
}

type FractionalStarRatingProps = {
  /** Average score on a 0–5 star scale. */
  score: number;
  size?: number;
  /** Gap between stars (default 1). */
  gap?: number;
};

/** 0–5 score with fractional fill — identical SVG glyphs on iOS and Android. */
export function FractionalStarRating({
  score,
  size = 24,
  gap = 1,
}: FractionalStarRatingProps) {
  const clamped = Math.max(0, Math.min(5, score));

  return (
    <View style={[styles.row, { height: size, gap }]}>
      {Array.from({ length: 5 }, (_, index) => {
        const fill = Math.max(0, Math.min(1, clamped - index));
        return <FractionalStar key={index} fill={fill} size={size} />;
      })}
    </View>
  );
}

type StaticStarRatingProps = {
  /** Half-star steps 1–10, or `-1` N/A (Swift `RatingValue`). */
  rating: number;
  size?: number;
  showLabel?: boolean;
};

/** Read-only half-star row for detail criteria (Swift `StaticStarRating`). */
export function StaticStarRating({
  rating,
  size = 22,
  showLabel = false,
}: StaticStarRatingProps) {
  const { t } = useAppTranslation();

  if (RatingValue.isNotApplicable(rating) || rating <= 0) {
    return (
      <View style={styles.na}>
        <Text style={styles.naLabel}>{t('rating.labels.na')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.staticWrap}>
      <View style={[styles.row, styles.staticGap, { height: size }]}>
        {Array.from({ length: 5 }, (_, index) => (
          <FractionalStar
            key={index}
            size={size}
            fill={RatingValue.fillForStar(index + 1, rating)}
          />
        ))}
      </View>
      {showLabel && RatingValue.isStarRating(rating) ? (
        <Text style={styles.label}>{ratingLabel(rating)}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  staticWrap: {
    gap: 6,
  },
  staticGap: {
    gap: 3,
  },
  starBase: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  clip: {
    overflow: 'hidden',
  },
  na: {
    alignSelf: 'flex-start',
    backgroundColor: GustraColors.bubble,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  naLabel: {
    fontSize: 13,
    color: 'rgba(35, 32, 26, 0.55)',
    fontWeight: '500',
  },
  label: {
    fontFamily: SERIF_FONT,
    fontSize: 15,
    color: 'rgba(35, 32, 26, 0.7)',
  },
});
