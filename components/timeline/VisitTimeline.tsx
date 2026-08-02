import { useMemo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  MountNode,
  VisitTimelineCard,
  type VisitTimelineEntry,
} from '@/components/timeline/VisitTimelineCard';
import { SerifText } from '@/components/ui/SerifText';
import { GustraColors } from '@/constants/Colors';
import { captionTextStyle } from '@/constants/Theme';
import { activeIntlLocale } from '@/i18n/formatDates';
import { useAppTranslation } from '@/hooks/useAppTranslation';

type GroupedMonth = {
  key: string;
  label: string;
  entries: VisitTimelineEntry[];
};

type YearGroup = {
  year: number;
  months: GroupedMonth[];
};

/** Group a (newest-first) entry list into year → month buckets. */
export function groupByYearAndMonth(
  entries: VisitTimelineEntry[],
): YearGroup[] {
  const locale = activeIntlLocale();
  const years: YearGroup[] = [];
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

/** Large serif year header, centered on the timeline (Apple tilt). */
function YearHeader({
  year,
  count,
}: {
  year: number;
  count: number | undefined;
}) {
  return (
    <View style={styles.yearHeaderRow}>
      <View style={styles.yearHeaderRule} />
      <MountNode style={styles.yearHeaderChip}>
        <SerifText size={28} weight="bold" style={styles.yearHeaderText}>
          {year}
        </SerifText>
      </MountNode>
      <View style={styles.yearHeaderRule} />
      {count !== undefined ? (
        <Text style={styles.yearCount}>{count}</Text>
      ) : null}
    </View>
  );
}

export type VisitTimelineProps = {
  entries: VisitTimelineEntry[];
  /** Render the card for one entry. Replaces the default press behavior. */
  renderCard?: (entry: VisitTimelineEntry, index: number) => ReactNode;
  /** Tap handler for the default card rendering. */
  onPressEntry?: (entry: VisitTimelineEntry) => void;
  /**
   * Show the year/month visit-count labels. Time Travel keeps them (total per
   * year, visits per month); the restaurant visits overview hides them because
   * every row is already an individual visit.
   */
  showCounts?: boolean;
};

/**
 * The shared Time Travel timeline: a continuous gold spine with animated
 * nodes, large serif year headers, month headers with visit counts, and the
 * cinematic visit cards. Used identically by Time Travel and the restaurant
 * visits overview so the two always match.
 *
 * Entries are expected newest-first (the same order as the timeline).
 */
export function VisitTimeline({
  entries,
  renderCard,
  onPressEntry,
  showCounts = true,
}: VisitTimelineProps) {
  const { t } = useAppTranslation();
  const yearGroups = useMemo(() => groupByYearAndMonth(entries), [entries]);

  if (entries.length === 0) return null;

  return (
    <View style={styles.timeline}>
      {yearGroups.map((yearGroup) => {
        const entriesInYear = yearGroup.months.reduce(
          (sum, m) => sum + m.entries.length,
          0,
        );
        return (
          <View key={yearGroup.year} style={styles.yearBlock}>
            <YearHeader year={yearGroup.year} count={showCounts ? entriesInYear : undefined} />

            <View style={styles.yearSpineTrack}>
              <View style={styles.yearSpineLine} />
              {yearGroup.months.map((month) => {
                if (month.entries.length === 0) return null;
                return (
                  <View key={month.key} style={styles.monthGroup}>
                    <View style={styles.monthRow}>
                      <View style={styles.monthRail}>
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
                      {showCounts ? (
                        <Text style={styles.monthCount}>
                          {t('passport.timeTravelMonthCount', {
                            count: month.entries.length,
                          })}
                        </Text>
                      ) : null}
                    </View>

                    {month.entries.map((entry, index) =>
                      renderCard ? (
                        renderCard(entry, index)
                      ) : (
                        <VisitTimelineCard
                          key={entry.reviewId}
                          entry={entry}
                          onPress={() => {
                            if (onPressEntry) onPressEntry(entry);
                          }}
                        />
                      ),
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
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
  /** Slim rail for the month marker (the visit cards bring their own rail). */
  monthRail: {
    width: 56,
    alignItems: 'center',
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
});
