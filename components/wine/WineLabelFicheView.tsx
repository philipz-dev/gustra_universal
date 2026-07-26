import { Image, StyleSheet, Text, View } from 'react-native';

import { PhotoPlaceholder } from '@/components/ui/PhotoPlaceholder';
import { SerifText } from '@/components/ui/SerifText';
import { GustraColors } from '@/constants/Colors';
import { bodyTextStyle, captionTextStyle, Theme } from '@/constants/Theme';
import type { WineLabelFiche } from '@/data/types';
import { useAppTranslation } from '@/hooks/useAppTranslation';

type WineLabelFicheViewProps = {
  fiche: WineLabelFiche;
};

type RowProps = {
  label: string;
  value: string;
};

function FicheRow({ label, value }: RowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

/**
 * House-styled wine fiche: label photo on top, fields by importance.
 */
export function WineLabelFicheView({ fiche }: WineLabelFicheViewProps) {
  const { t } = useAppTranslation();
  const uri = fiche.labelPhotoUri?.trim() ?? '';
  const alcohol =
    fiche.alcoholPercent != null && Number.isFinite(fiche.alcoholPercent)
      ? `${fiche.alcoholPercent}%`
      : '';

  return (
    <View style={styles.wrap}>
      <View style={styles.photoFrame}>
        {uri ? (
          <Image source={{ uri }} style={styles.photo} resizeMode="contain" />
        ) : (
          <PhotoPlaceholder iconSize={48} />
        )}
      </View>

      <SerifText size={22} weight="semibold" style={styles.title}>
        {fiche.nameAndEstate}
      </SerifText>

      {fiche.typeStyle?.trim() ? (
        <FicheRow
          label={t('wineScan.fiche.typeStyle')}
          value={fiche.typeStyle.trim()}
        />
      ) : null}
      {fiche.countryRegion?.trim() ? (
        <FicheRow
          label={t('wineScan.fiche.countryRegion')}
          value={fiche.countryRegion.trim()}
        />
      ) : null}
      {fiche.vintage?.trim() ? (
        <FicheRow
          label={t('wineScan.fiche.vintage')}
          value={fiche.vintage.trim()}
        />
      ) : null}
      {fiche.grapes?.trim() ? (
        <FicheRow
          label={t('wineScan.fiche.grapes')}
          value={fiche.grapes.trim()}
        />
      ) : null}
      {alcohol ? (
        <FicheRow label={t('wineScan.fiche.alcohol')} value={alcohol} />
      ) : null}
      {fiche.foodPairings?.trim() ? (
        <FicheRow
          label={t('wineScan.fiche.foodPairings')}
          value={fiche.foodPairings.trim()}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  photoFrame: {
    alignSelf: 'center',
    width: '70%',
    aspectRatio: 0.72,
    borderRadius: Theme.radius.md,
    overflow: 'hidden',
    backgroundColor: GustraColors.bubble,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(35, 32, 26, 0.14)',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  title: {
    color: GustraColors.ink,
    textAlign: 'center',
    marginTop: 4,
  },
  row: {
    gap: 4,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(35, 32, 26, 0.12)',
  },
  rowLabel: {
    ...captionTextStyle,
    fontSize: 13,
    fontWeight: '600',
    color: GustraColors.forestGreen,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  rowValue: {
    ...bodyTextStyle,
    fontSize: 17,
    color: GustraColors.ink,
  },
});
