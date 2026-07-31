import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FractionalStarRating } from '@/components/ui/StarRating';
import { GustraColors } from '@/constants/Colors';
import { Theme, bodyTextStyle } from '@/constants/Theme';

type RevisitStatsCardProps = {
  revisitCount: number;
  lastVisitIso: string | null;
  revisitAverage: number;
  formatShortDate: (iso: string) => string;
  formatScoreOutOfFive: (score: number) => string;
  t: (key: string, options?: any) => string;
};

export const RevisitStatsCard = React.memo(function RevisitStatsCard({
  revisitCount,
  lastVisitIso,
  revisitAverage,
  formatShortDate,
  formatScoreOutOfFive,
  t,
}: RevisitStatsCardProps) {
  if (revisitCount <= 0) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.revisitTitle}>
        {t('forms.review.otherVisits', { count: revisitCount })}
      </Text>
      <View style={styles.revisitMeta}>
        {lastVisitIso ? (
          <Text style={styles.revisitMetaText}>
            {t('forms.review.mostRecent', { date: formatShortDate(lastVisitIso) })}
          </Text>
        ) : null}
        {revisitAverage > 0 ? (
          <View style={styles.revisitScore}>
            <FractionalStarRating score={revisitAverage} size={16} />
            <Text style={styles.revisitMetaText}>
              {t('forms.review.avg', {
                score: formatScoreOutOfFive(revisitAverage),
              })}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: GustraColors.bubble,
    borderRadius: Theme.radius.xxl,
    padding: 16,
    gap: 12,
  },
  revisitTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: GustraColors.ink,
  },
  revisitMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
  },
  revisitMetaText: {
    ...bodyTextStyle,
    fontSize: 14,
    color: 'rgba(35, 32, 26, 0.6)',
  },
  revisitScore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
