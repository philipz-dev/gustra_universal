import type { ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { HouseEmptyState } from '@/components/ui/HouseEmptyState';
import { HouseToolbarIconButton } from '@/components/ui/HouseToolbarIconButton';
import { SerifText } from '@/components/ui/SerifText';
import { GustraColors } from '@/constants/Colors';
import { bodyTextStyle, Theme } from '@/constants/Theme';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { Haptics } from '@/services/haptics';

type EmptySystemImage = NonNullable<
  ComponentProps<typeof HouseEmptyState>['systemImage']
>;
type EmptyAndroidImage = NonNullable<
  ComponentProps<typeof HouseEmptyState>['androidImage']
>;

export type MultiSelectFilterPanelProps = {
  title: string;
  emptyTitle: string;
  emptyDescription: string;
  emptySystemImage?: EmptySystemImage;
  emptyAndroidImage?: EmptyAndroidImage;
  items: string[];
  selected: string[];
  /** Display label for each raw item (e.g. place type keys). */
  titleForItem?: (item: string) => string;
  bottomInset?: number;
  onChangeSelected: (next: string[]) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

function CheckboxIcon({ checked }: { checked: boolean }) {
  return (
    <SymbolView
      name={{
        ios: checked ? 'checkmark.square.fill' : 'square',
        android: checked ? 'check_box' : 'check_box_outline_blank',
        web: checked ? 'check_box' : 'check_box_outline_blank',
      }}
      tintColor={checked ? GustraColors.forestGreen : 'rgba(35, 32, 26, 0.35)'}
      size={24}
    />
  );
}

/**
 * In-sheet multi-select (Swift `MultiSelectFilterSheet` content).
 * Pushed inside Filter options — no second Modal.
 */
export function MultiSelectFilterPanel({
  title,
  emptyTitle,
  emptyDescription,
  emptySystemImage = 'mappin.and.ellipse',
  emptyAndroidImage = 'place',
  items,
  selected,
  titleForItem = (item) => item,
  bottomInset = 0,
  onChangeSelected,
  onConfirm,
  onCancel,
}: MultiSelectFilterPanelProps) {
  const { t } = useAppTranslation();
  const selectedSet = new Set(selected);
  const selectAllOn = items.length > 0 && selected.length === items.length;

  const toggle = (item: string) => {
    Haptics.selectionChanged();
    if (selectedSet.has(item)) {
      onChangeSelected(selected.filter((value) => value !== item));
    } else {
      onChangeSelected([...selected, item]);
    }
  };

  const toggleSelectAll = () => {
    Haptics.selectionChanged();
    onChangeSelected(selectAllOn ? [] : [...items]);
  };

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
          {title}
        </SerifText>
        <HouseToolbarIconButton
          iosName="checkmark"
          androidName="check"
          accessibilityLabel={t('filters.done')}
          onPress={onConfirm}
        />
      </View>

      {items.length === 0 ? (
        <HouseEmptyState
          title={emptyTitle}
          description={emptyDescription}
          systemImage={emptySystemImage}
          androidImage={emptyAndroidImage}
        />
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.list,
            { paddingBottom: 24 + bottomInset },
          ]}
          keyboardShouldPersistTaps="handled">
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selectAllOn }}
            accessibilityLabel={t('filters.selectAll')}
            accessibilityHint={
              selectAllOn
                ? t('filters.deselectAllHint')
                : t('filters.selectAllHint')
            }
            onPress={toggleSelectAll}
            style={({ pressed }) => [
              styles.selectAllRow,
              pressed && styles.pressed,
            ]}>
            <CheckboxIcon checked={selectAllOn} />
          </Pressable>

          {items.map((item) => {
            const isSelected = selectedSet.has(item);
            return (
              <Pressable
                key={item}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                onPress={() => toggle(item)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                <CheckboxIcon checked={isSelected} />
                <Text style={styles.rowLabel}>{titleForItem(item)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
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
  list: {
    paddingHorizontal: Theme.spacing.listRowHorizontal,
    paddingTop: 12,
    gap: 8,
  },
  selectAllRow: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(236, 227, 207, 0.45)',
    borderRadius: Theme.radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(236, 227, 207, 0.45)',
    borderRadius: Theme.radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rowLabel: {
    ...bodyTextStyle,
    flex: 1,
    fontSize: 17,
    color: GustraColors.ink,
  },
  pressed: {
    opacity: 0.85,
  },
});
