import { useCallback, useRef, useState, type RefObject } from 'react';
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ScrollView,
} from 'react-native';
import { SymbolView } from 'expo-symbols';

import { SerifText } from '@/components/ui/SerifText';
import { GustraColors } from '@/constants/Colors';
import {
  bodyTextStyle,
  captionTextStyle,
  Theme,
} from '@/constants/Theme';
import type { WineLabelFiche, WineTastingTraitKey } from '@/data/types';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { Haptics } from '@/services/haptics';
import { wineLabelGrapeDisplay } from '@/services/wine/wineGrapeVarieties';
import {
  formatTraitScore,
  shouldShowTasteProfile,
  tasteProfileScaleRows,
  traitScoreToBarFraction,
} from '@/services/wine/wineTasteProfile';

type WineTasteProfileSectionProps = {
  fiche: WineLabelFiche;
  /** Parent ScrollView — used to bring the expanded card fully on screen. */
  scrollRef?: RefObject<ScrollView | null>;
  /** Live contentOffset.y of that ScrollView. */
  scrollYRef?: RefObject<number>;
  /** Clearance under the visible area (tab bar / safe area). */
  scrollBottomInset?: number;
};

function traitPoleKeys(key: WineTastingTraitKey): {
  left: string;
  right: string;
} {
  switch (key) {
    case 'body':
      return {
        left: 'wineScan.fiche.tasteProfile.poles.bodyLight',
        right: 'wineScan.fiche.tasteProfile.poles.bodyFull',
      };
    case 'tannins':
      return {
        left: 'wineScan.fiche.tasteProfile.poles.tanninsSoft',
        right: 'wineScan.fiche.tasteProfile.poles.tanninsFirm',
      };
    case 'acidity':
      return {
        left: 'wineScan.fiche.tasteProfile.poles.aciditySoft',
        right: 'wineScan.fiche.tasteProfile.poles.acidityLively',
      };
    case 'sweetness':
      return {
        left: 'wineScan.fiche.tasteProfile.poles.sweetnessDry',
        right: 'wineScan.fiche.tasteProfile.poles.sweetnessSweet',
      };
    default:
      return {
        left: 'wineScan.fiche.tasteProfile.poles.sweetnessDry',
        right: 'wineScan.fiche.tasteProfile.poles.sweetnessSweet',
      };
  }
}

/**
 * Read-only collapsible taste profile (AI label estimate).
 * Not shown when confidence is low or there is nothing meaningful to show.
 */
export function WineTasteProfileSection({
  fiche,
  scrollRef,
  scrollYRef,
  scrollBottomInset = 24,
}: WineTasteProfileSectionProps) {
  const { t } = useAppTranslation();
  const [expanded, setExpanded] = useState(false);
  const sectionRef = useRef<View>(null);
  const ensureVisiblePending = useRef(false);

  const ensureFullyVisible = useCallback(() => {
    const scroll = scrollRef?.current;
    if (!scroll || !sectionRef.current) return;

    sectionRef.current.measureInWindow((_x, y, _w, h) => {
      const windowH = Dimensions.get('window').height;
      const topSafe = 72;
      const visibleBottom = windowH - Math.max(12, scrollBottomInset);
      const sectionBottom = y + h;
      const scrollY = scrollYRef?.current ?? 0;
      let delta = 0;
      if (sectionBottom > visibleBottom) {
        delta = sectionBottom - visibleBottom + 16;
      } else if (y < topSafe) {
        delta = y - topSafe;
      }
      if (delta === 0) return;
      scroll.scrollTo({
        y: Math.max(0, scrollY + delta),
        animated: true,
      });
    });
  }, [scrollBottomInset, scrollRef, scrollYRef]);

  if (!shouldShowTasteProfile(fiche)) return null;

  const scales = tasteProfileScaleRows(fiche);
  const grapes = wineLabelGrapeDisplay(fiche);
  const serving = fiche.servingTempHint?.trim() ?? '';
  const aeration = fiche.aerationHint?.trim() ?? '';
  // drinkWindowHint is subjective — never shown in UI.

  return (
    <View ref={sectionRef} style={styles.section} collapsable={false}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={
          expanded
            ? t('wineScan.fiche.tasteProfile.collapseA11y')
            : t('wineScan.fiche.tasteProfile.expandA11y')
        }
        onPress={() => {
          Haptics.selectionChanged();
          setExpanded((v) => {
            const next = !v;
            if (next) ensureVisiblePending.current = true;
            return next;
          });
        }}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}>
        <Text style={styles.title}>
          {t('wineScan.fiche.tasteProfile.title')}
        </Text>
        <SymbolView
          name={{
            ios: expanded ? 'chevron.up' : 'chevron.down',
            android: expanded ? 'expand_less' : 'expand_more',
            web: expanded ? 'expand_less' : 'expand_more',
          }}
          tintColor="rgba(35, 32, 26, 0.45)"
          size={18}
          weight="semibold"
        />
      </Pressable>

      {expanded ? (
        <View
          style={styles.body}
          onLayout={() => {
            if (!ensureVisiblePending.current) return;
            ensureVisiblePending.current = false;
            requestAnimationFrame(() => {
              ensureFullyVisible();
            });
          }}>
          {grapes ? (
            <View style={styles.block}>
              <Text style={styles.blockLabel}>
                {t('wineScan.fiche.grapes')}
              </Text>
              <Text style={styles.blockValue}>{grapes}</Text>
            </View>
          ) : null}

          <Text style={styles.source}>
            {t('wineScan.fiche.tasteProfile.source')}
          </Text>

          {scales.length > 0 ? (
            <View style={styles.scales}>
              {scales.map((trait) => {
                const poles = traitPoleKeys(trait.key);
                const fill = traitScoreToBarFraction(trait.score);
                const scoreLabel = formatTraitScore(trait.score);
                return (
                  <View
                    key={trait.key}
                    style={styles.scaleRow}
                    accessibilityLabel={`${t(poles.left)} – ${t(poles.right)}, ${scoreLabel}`}>
                    <View style={styles.chartColumn}>
                      <View style={styles.poleRow}>
                        <Text style={styles.poleLeft}>{t(poles.left)}</Text>
                        <Text style={styles.poleRight}>{t(poles.right)}</Text>
                      </View>
                      <View style={styles.track}>
                        <View
                          style={[
                            styles.fill,
                            { width: `${fill * 100}%` },
                          ]}
                        />
                      </View>
                    </View>
                    <SerifText
                      size={17}
                      weight="semibold"
                      style={styles.score}>
                      {scoreLabel}
                    </SerifText>
                  </View>
                );
              })}
            </View>
          ) : null}

          {serving || aeration ? (
            <View style={styles.serviceList}>
              {serving ? (
                <ServiceRow
                  ios="thermometer"
                  android="thermostat"
                  web="thermostat"
                  text={serving}
                />
              ) : null}
              {aeration ? (
                <ServiceRow
                  ios="hourglass"
                  android="hourglass_empty"
                  web="hourglass_empty"
                  text={aeration}
                />
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function ServiceRow({
  ios,
  android,
  web,
  text,
}: {
  ios: string;
  android: string;
  web: string;
  text: string;
}) {
  return (
    <View style={styles.serviceRow}>
      <SymbolView
        name={{ ios, android, web }}
        tintColor={GustraColors.forestGreen}
        size={16}
        weight="medium"
      />
      <Text style={styles.serviceText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 8,
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    minHeight: Theme.size.hitTarget - 8,
  },
  pressed: {
    opacity: 0.72,
  },
  title: {
    ...captionTextStyle,
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(36, 78, 57, 0.85)',
    letterSpacing: 0.55,
    textTransform: 'uppercase',
  },
  body: {
    gap: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: Theme.radius.lg,
    backgroundColor: GustraColors.bubble,
  },
  source: {
    ...captionTextStyle,
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(35, 32, 26, 0.45)',
  },
  scales: {
    gap: 10,
  },
  scaleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  chartColumn: {
    flex: 1,
    gap: 4,
  },
  poleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  poleLeft: {
    ...captionTextStyle,
    fontSize: 12,
    color: 'rgba(35, 32, 26, 0.55)',
    flexShrink: 1,
  },
  poleRight: {
    ...captionTextStyle,
    fontSize: 12,
    color: 'rgba(35, 32, 26, 0.55)',
    textAlign: 'right',
    flexShrink: 1,
  },
  track: {
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(35, 32, 26, 0.1)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: GustraColors.forestGreen,
  },
  score: {
    minWidth: 36,
    marginBottom: -1,
    textAlign: 'right',
    color: GustraColors.forestGreen,
  },
  block: {
    gap: 4,
  },
  blockLabel: {
    ...captionTextStyle,
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(36, 78, 57, 0.75)',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  blockValue: {
    ...bodyTextStyle,
    fontSize: 15,
    color: GustraColors.ink,
    lineHeight: 22,
  },
  serviceList: {
    gap: 10,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  serviceText: {
    flex: 1,
    ...bodyTextStyle,
    fontSize: 15,
    lineHeight: 21,
    color: 'rgba(35, 32, 26, 0.88)',
  },
});
