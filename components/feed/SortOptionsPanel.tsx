import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import type { FeedSortKind } from '@/components/feed/feedFilters';
import { HouseToolbarIconButton } from '@/components/ui/HouseToolbarIconButton';
import { SerifText } from '@/components/ui/SerifText';
import { GustraColors } from '@/constants/Colors';
import { bodyTextStyle, captionTextStyle, Theme } from '@/constants/Theme';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { Haptics } from '@/services/haptics';

type SortCriterion = { id: string; title: string };

type SortOptionsPanelProps = {
  draftSortKind: FeedSortKind;
  criteria: SortCriterion[];
  bottomInset?: number;
  onSelect: (sortKind: FeedSortKind) => void;
  onCancel: () => void;
};

/**
 * Sort picker (Swift `SortOptionsSheet`) — Average score + enabled criteria.
 */
export function SortOptionsPanel({
  draftSortKind,
  criteria,
  bottomInset = 0,
  onSelect,
  onCancel,
}: SortOptionsPanelProps) {
  const { t } = useAppTranslation();

  return (
    <View style={styles.root}>
      <View style={styles.nav}>
        <HouseToolbarIconButton
          iosName="chevron.backward"
          androidName="arrow-back"
          accessibilityLabel={t('common.back')}
          onPress={onCancel}
        />
        <SerifText size={20} weight="semibold" style={styles.navTitle}>
          {t('filters.sortBy')}
        </SerifText>
        <View style={styles.navSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.list,
          { paddingBottom: 24 + bottomInset },
        ]}
        keyboardShouldPersistTaps="handled">
        <SortRow
          title={t('filters.sort.averageScore')}
          subtitle={t('filters.default')}
          selected={draftSortKind.type === 'averageScore'}
          onPress={() => onSelect({ type: 'averageScore' })}
        />
        {criteria.map((criterion) => (
          <SortRow
            key={criterion.id}
            title={criterion.title}
            selected={
              draftSortKind.type === 'criterion' &&
              draftSortKind.criterionId === criterion.id
            }
            onPress={() =>
              onSelect({ type: 'criterion', criterionId: criterion.id })
            }
          />
        ))}
      </ScrollView>
    </View>
  );
}

function SortRow({
  title,
  subtitle,
  selected,
  onPress,
}: {
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        Haptics.selectionChanged();
        onPress();
      }}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {selected ? (
        <SymbolView
          name={{ ios: 'checkmark', android: 'check', web: 'check' }}
          tintColor={GustraColors.forestGreen}
          size={20}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: GustraColors.cream,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: GustraColors.forestGreen,
  },
  navTitle: {
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
  navSpacer: {
    width: 44,
    height: 44,
  },
  list: {
    paddingHorizontal: Theme.spacing.listRowHorizontal,
    paddingTop: 16,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: 'rgba(236, 227, 207, 0.45)',
    borderRadius: Theme.radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...bodyTextStyle,
    fontSize: 17,
    color: GustraColors.ink,
  },
  rowSubtitle: {
    ...captionTextStyle,
    fontSize: 13,
    color: 'rgba(35, 32, 26, 0.55)',
  },
  pressed: {
    opacity: 0.85,
  },
});
