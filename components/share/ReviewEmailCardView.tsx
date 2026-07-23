import { useEffect, useRef } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { SerifText } from '@/components/ui/SerifText';
import { GustraColors } from '@/constants/Colors';
import { bodyTextStyle, captionTextStyle } from '@/constants/Theme';

export const EMAIL_CARD_CONTENT_WIDTH = 390;
export const EMAIL_CARD_OUTER_WIDTH = EMAIL_CARD_CONTENT_WIDTH + 32;

export type EmailCriterionRow = {
  id: string;
  title: string;
  score: number;
  comment: string;
};

export type ReviewEmailCardViewProps = {
  sharedBy: string;
  restaurantName: string;
  addressLines: string[];
  metaLine: string;
  photoUris: string[];
  overallScore: number;
  criteriaRows: EmailCriterionRow[];
  generalComment: string;
  onPhotosReady?: () => void;
};

/** Same glyph logic as Swift `ReviewEmailCardView.glyphStars`. */
export function glyphStars(score: number): string {
  if (!(score > 0)) return '';
  let result = '';
  for (let i = 1; i <= 5; i += 1) {
    const full = i;
    const half = i - 0.5;
    if (score + 0.001 >= full) {
      result += '★';
    } else if (score + 0.001 >= half) {
      result += '★';
    } else {
      result += '☆';
    }
  }
  return result;
}

function photoRows(uris: string[]): string[][] {
  const rows: string[][] = [];
  for (let i = 0; i < uris.length; i += 2) {
    rows.push(uris.slice(i, i + 2));
  }
  return rows;
}

/**
 * Phone-width visual card for email recommendation (Swift `ReviewEmailCardView`).
 * Footer sits under the review content so Mail’s attachment order still looks correct.
 */
export function ReviewEmailCardView({
  sharedBy,
  restaurantName,
  addressLines,
  metaLine,
  photoUris,
  overallScore,
  criteriaRows,
  generalComment,
  onPhotosReady,
}: ReviewEmailCardViewProps) {
  const trimmedComment = generalComment.trim();
  const rows = photoRows(photoUris);
  const loadedRef = useRef(0);
  const readySent = useRef(false);

  useEffect(() => {
    loadedRef.current = 0;
    readySent.current = false;
    if (photoUris.length === 0) {
      const id = requestAnimationFrame(() => {
        if (!readySent.current) {
          readySent.current = true;
          onPhotosReady?.();
        }
      });
      return () => cancelAnimationFrame(id);
    }
    return undefined;
  }, [photoUris, onPhotosReady]);

  const markPhoto = () => {
    loadedRef.current += 1;
    if (
      !readySent.current &&
      loadedRef.current >= photoUris.length
    ) {
      readySent.current = true;
      onPhotosReady?.();
    }
  };

  return (
    <View style={styles.outer} collapsable={false}>
      <View style={styles.card} collapsable={false}>
        <View style={styles.header}>
          <SerifText size={28} weight="bold" style={styles.headerBrand}>
            Gustra
          </SerifText>
          <Text style={styles.headerTagline}>making food memories</Text>
        </View>

        <Text style={styles.intro}>
          <Text style={styles.introName}>{sharedBy}</Text>
          {' '}
          <Text style={styles.introRest}>
            shared a restaurant review with you.
          </Text>
        </Text>

        <View style={styles.restaurantBlock}>
          <SerifText size={22} weight="bold" style={styles.restaurantName}>
            {restaurantName}
          </SerifText>
          {addressLines.length > 0 ? (
            <Text style={styles.address}>{addressLines.join('\n')}</Text>
          ) : null}
          {metaLine ? <Text style={styles.meta}>{metaLine}</Text> : null}
        </View>

        {rows.length > 0 ? (
          <View style={styles.photosBlock}>
            {rows.map((row, rowIndex) => (
              <View key={`row-${rowIndex}`} style={styles.photoRow}>
                {row.map((uri) => (
                  <Image
                    key={uri}
                    source={{ uri }}
                    style={styles.photo}
                    resizeMode="cover"
                    onLoad={markPhoto}
                    onError={markPhoto}
                  />
                ))}
                {row.length === 1 ? <View style={styles.photoSpacer} /> : null}
              </View>
            ))}
          </View>
        ) : null}

        {overallScore > 0 ? (
          <View style={styles.overallWrap}>
            <View style={styles.overall}>
              <Text style={styles.sectionLabel}>OVERALL</Text>
              <Text style={styles.stars}>{glyphStars(overallScore)}</Text>
              <Text style={styles.overallAverage}>
                {overallScore.toFixed(1)} / 5 average
              </Text>
            </View>
          </View>
        ) : null}

        {criteriaRows.length > 0 ? (
          <View style={styles.criteriaBlock}>
            {criteriaRows.map((row, index) => (
              <View key={row.id}>
                <View style={styles.criterion}>
                  <Text style={styles.criterionTitle}>{row.title}</Text>
                  <Text style={styles.criterionStars}>
                    {glyphStars(row.score)}
                  </Text>
                  {row.comment ? (
                    <Text style={styles.criterionComment}>{row.comment}</Text>
                  ) : null}
                </View>
                {index < criteriaRows.length - 1 ? (
                  <View style={styles.divider} />
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {trimmedComment ? (
          <View style={styles.commentsBlock}>
            <Text style={styles.sectionLabel}>GENERAL COMMENTS</Text>
            <Text style={styles.commentsBody}>{`“${trimmedComment}”`}</Text>
          </View>
        ) : (
          <View style={styles.commentsSpacer} />
        )}

        <View style={styles.footer}>
          <Text style={styles.footerTitle}>Powered by Gustra</Text>
          <Text style={styles.footerTagline}>making food memories</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: EMAIL_CARD_OUTER_WIDTH,
    padding: 16,
    backgroundColor: GustraColors.cream,
  },
  card: {
    width: EMAIL_CARD_CONTENT_WIDTH,
    backgroundColor: GustraColors.cream,
    borderRadius: 20,
    overflow: 'hidden',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 22,
    paddingHorizontal: 20,
    backgroundColor: GustraColors.forestGreen,
  },
  headerBrand: {
    color: '#FFFFFF',
    textAlign: 'center',
  },
  headerTagline: {
    ...captionTextStyle,
    marginTop: 6,
    fontSize: 15,
    fontStyle: 'italic',
    color: 'rgba(255,255,255,0.78)',
    textAlign: 'center',
  },
  intro: {
    ...bodyTextStyle,
    paddingHorizontal: 22,
    paddingTop: 18,
    fontSize: 15,
    lineHeight: 20,
  },
  introName: {
    fontWeight: '600',
    color: GustraColors.forestGreen,
  },
  introRest: {
    color: GustraColors.ink,
  },
  restaurantBlock: {
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 8,
  },
  restaurantName: {
    color: GustraColors.ink,
  },
  address: {
    ...bodyTextStyle,
    marginTop: 8,
    fontSize: 15,
    lineHeight: 20,
    color: 'rgba(35,32,26,0.62)',
  },
  meta: {
    ...captionTextStyle,
    marginTop: 8,
    fontSize: 13,
    color: GustraColors.forestGreen,
  },
  photosBlock: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 10,
  },
  photoRow: {
    flexDirection: 'row',
    gap: 10,
  },
  photo: {
    flex: 1,
    height: 150,
    borderRadius: 12,
    backgroundColor: GustraColors.bubble,
  },
  photoSpacer: {
    flex: 1,
    height: 150,
  },
  overallWrap: {
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  overall: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(236,227,207,0.55)',
  },
  sectionLabel: {
    ...captionTextStyle,
    fontSize: 12,
    letterSpacing: 0.8,
    color: 'rgba(35,32,26,0.45)',
    textTransform: 'uppercase',
  },
  stars: {
    marginTop: 4,
    fontSize: 22,
    color: GustraColors.gold,
  },
  overallAverage: {
    ...bodyTextStyle,
    marginTop: 4,
    fontSize: 15,
    color: GustraColors.ink,
  },
  criteriaBlock: {
    paddingHorizontal: 22,
    paddingBottom: 8,
  },
  criterion: {
    paddingVertical: 12,
  },
  criterionTitle: {
    ...bodyTextStyle,
    fontSize: 17,
    fontWeight: '600',
    color: GustraColors.ink,
  },
  criterionStars: {
    marginTop: 4,
    fontSize: 20,
    color: GustraColors.gold,
  },
  criterionComment: {
    ...bodyTextStyle,
    marginTop: 4,
    fontSize: 15,
    lineHeight: 20,
    color: 'rgba(35,32,26,0.72)',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(35,32,26,0.12)',
  },
  commentsBlock: {
    paddingHorizontal: 22,
    paddingTop: 4,
    paddingBottom: 18,
  },
  commentsBody: {
    ...bodyTextStyle,
    marginTop: 6,
    fontSize: 17,
    lineHeight: 24,
    fontStyle: 'italic',
    color: GustraColors.ink,
  },
  commentsSpacer: {
    height: 18,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 22,
    paddingHorizontal: 20,
    backgroundColor: GustraColors.forestGreen,
  },
  footerTitle: {
    ...bodyTextStyle,
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  footerTagline: {
    ...captionTextStyle,
    marginTop: 6,
    fontSize: 12,
    fontStyle: 'italic',
    color: 'rgba(255,255,255,0.75)',
  },
});
