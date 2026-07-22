import { StyleSheet, View } from 'react-native';

import { CommentChip } from '@/components/detail/CommentChip';
import { SerifText } from '@/components/ui/SerifText';
import { StaticStarRating } from '@/components/ui/StarRating';
import { GustraColors } from '@/constants/Colors';
import type { CriterionRating } from '@/data/types';

export function CriterionSection({ criterion }: { criterion: CriterionRating }) {
  return (
    <View style={styles.section}>
      <SerifText size={20} weight="bold" style={styles.title}>
        {criterion.title}
      </SerifText>
      <StaticStarRating rating={criterion.rating} showLabel />
      {criterion.comment ? <CommentChip text={criterion.comment} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
  title: {
    color: GustraColors.ink,
  },
});
