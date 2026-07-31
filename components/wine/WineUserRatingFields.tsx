import { useRef } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { InteractiveStarRating } from '@/components/review/InteractiveStarRating';
import { GustraColors } from '@/constants/Colors';
import { HOUSE_KEYBOARD_APPEARANCE } from '@/constants/Keyboard';
import { bodyTextStyle, captionTextStyle, Theme } from '@/constants/Theme';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { RatingValue } from '@/services/reviews/ratings';

type WineUserRatingFieldsProps = {
  rating: number;
  onRatingChange: (rating: number) => void;
  note: string;
  onNoteChange: (note: string) => void;
  onScrubbingChange?: (scrubbing: boolean) => void;
  /** Keep the note field above the keyboard (parent ScrollView). */
  onNoteFocus?: (input: TextInput | null) => void;
  /** Re-scroll when the multiline note grows while typing. */
  onNoteResize?: (input: TextInput | null) => void;
};

/** Stars (required) + optional note (only after stars) — scan result & wine edit. */
export function WineUserRatingFields({
  rating,
  onRatingChange,
  note,
  onNoteChange,
  onScrubbingChange,
  onNoteFocus,
  onNoteResize,
}: WineUserRatingFieldsProps) {
  const { t } = useAppTranslation();
  const noteRef = useRef<TextInput>(null);
  const showNote = RatingValue.isStarRating(rating);

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>{t('wineScan.resultRatingTitle')}</Text>
      <InteractiveStarRating
        rating={rating}
        onChange={onRatingChange}
        onScrubbingChange={onScrubbingChange}
      />
      {showNote ? (
        <TextInput
          ref={noteRef}
          value={note}
          onChangeText={onNoteChange}
          onFocus={() => onNoteFocus?.(noteRef.current)}
          onContentSizeChange={() => onNoteResize?.(noteRef.current)}
          placeholder={t('wineScan.drinksCommentPlaceholder')}
          placeholderTextColor="rgba(35, 32, 26, 0.4)"
          multiline
          keyboardAppearance={HOUSE_KEYBOARD_APPEARANCE}
          style={styles.noteField}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 8,
    backgroundColor: GustraColors.bubble,
    borderRadius: Theme.radius.xl,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  heading: {
    ...captionTextStyle,
    fontSize: 11,
    fontWeight: '700',
    color: GustraColors.forestGreen,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  noteField: {
    ...bodyTextStyle,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Theme.radius.md,
    backgroundColor: 'rgba(245, 238, 221, 0.9)',
    fontSize: 15,
    color: GustraColors.ink,
    textAlignVertical: 'top',
  },
});
