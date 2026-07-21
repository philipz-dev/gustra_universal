import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { GustraColors } from '@/constants/Colors';

const EMPTY_GOLD = 'rgba(217, 162, 39, 0.35)';

/**
 * Rounded 5-point star path in a 24×24 viewBox (SF Symbol–like proportions).
 */
const STAR_PATH =
  'M12 2.2l2.55 6.2 6.7.55-5.1 4.45 1.55 6.5L12 16.3l-5.7 3.6 1.55-6.5-5.1-4.45 6.7-.55L12 2.2z';

type StarIconProps = {
  size: number;
  color: string;
};

function StarIcon({ size, color }: StarIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={STAR_PATH} fill={color} />
    </Svg>
  );
}

type FractionalStarRatingProps = {
  score: number;
  size?: number;
};

/** 0–5 score with fractional fill — identical SVG glyphs on iOS and Android. */
export function FractionalStarRating({ score, size = 24 }: FractionalStarRatingProps) {
  const clamped = Math.max(0, Math.min(5, score));

  return (
    <View style={[styles.row, { height: size }]}>
      {Array.from({ length: 5 }, (_, index) => {
        const fill = Math.max(0, Math.min(1, clamped - index));
        return <FractionalStar key={index} fill={fill} size={size} />;
      })}
    </View>
  );
}

function FractionalStar({ fill, size }: { fill: number; size: number }) {
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

type StaticStarRatingProps = {
  rating: number;
  size?: number;
};

/** Integer 1–5 stars for detail criteria. */
export function StaticStarRating({ rating, size = 22 }: StaticStarRatingProps) {
  if (rating <= 0) {
    return (
      <View style={styles.na}>
        <Text style={styles.naLabel}>N/A</Text>
      </View>
    );
  }

  return (
    <View style={[styles.row, styles.staticGap, { height: size }]}>
      {Array.from({ length: 5 }, (_, index) => (
        <StarIcon
          key={index}
          size={size}
          color={index < rating ? GustraColors.gold : EMPTY_GOLD}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
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
});
