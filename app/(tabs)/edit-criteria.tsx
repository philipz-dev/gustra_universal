import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GustraSwitch } from '@/components/ui/GustraSwitch';
import { GustraColors } from '@/constants/Colors';
import { Theme, bodyTextStyle, captionTextStyle } from '@/constants/Theme';
import {
  CUSTOM_CRITERION_MAX_NAME_LENGTH,
  STANDARD_CRITERIA,
  useCriteriaSettings,
} from '@/context/CriteriaSettings';

export default function EditCriteriaScreen() {
  const insets = useSafeAreaInsets();
  const {
    customCriteria,
    isStandardEnabled,
    setStandardEnabled,
    setCustomEnabled,
    addCustomCriterion,
    deleteCustomCriterion,
  } = useCriteriaSettings();
  const [newCustomName, setNewCustomName] = useState('');

  const addNew = () => {
    if (!addCustomCriterion(newCustomName)) return;
    setNewCustomName('');
  };

  const confirmDelete = (id: string, name: string) => {
    Alert.alert('Delete criterion', `Remove “${name}”?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteCustomCriterion(id),
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom:
              Theme.spacing.floatingTabBarClearance + insets.bottom + 24,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        overScrollMode="never"
        showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          {STANDARD_CRITERIA.map((criterion, index) => (
            <View
              key={criterion.id}
              style={[
                styles.row,
                index < STANDARD_CRITERIA.length - 1 ||
                customCriteria.length > 0
                  ? styles.rowBorder
                  : null,
              ]}>
              <Text style={styles.rowTitle}>{criterion.title}</Text>
              <GustraSwitch
                value={isStandardEnabled(criterion.id)}
                onValueChange={(value) =>
                  setStandardEnabled(criterion.id, value)
                }
              />
            </View>
          ))}

          {customCriteria.map((criterion) => (
            <View key={criterion.id} style={[styles.row, styles.rowBorder]}>
              <Text
                style={[styles.rowTitle, styles.customName]}
                numberOfLines={1}>
                {criterion.name}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete ${criterion.name}`}
                hitSlop={8}
                onPress={() => confirmDelete(criterion.id, criterion.name)}
                style={({ pressed }) => pressed && styles.pressed}>
                <SymbolView
                  name={{ ios: 'trash', android: 'delete', web: 'delete' }}
                  tintColor={GustraColors.ratingAvoid}
                  size={20}
                />
              </Pressable>
              <GustraSwitch
                value={criterion.isEnabled}
                onValueChange={(value) => setCustomEnabled(criterion.id, value)}
              />
            </View>
          ))}

          <View style={styles.addRow}>
            <TextInput
              value={newCustomName}
              onChangeText={(text) =>
                setNewCustomName(text.slice(0, CUSTOM_CRITERION_MAX_NAME_LENGTH))
              }
              placeholder="Custom"
              placeholderTextColor="rgba(35, 32, 26, 0.4)"
              style={styles.input}
              returnKeyType="done"
              onSubmitEditing={addNew}
              maxLength={CUSTOM_CRITERION_MAX_NAME_LENGTH}
            />
            {newCustomName.trim().length > 0 ? (
              <Pressable
                accessibilityRole="button"
                onPress={addNew}
                style={({ pressed }) => [
                  styles.addButton,
                  pressed && styles.pressed,
                ]}>
                <Text style={styles.addLabel}>Add</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <Text style={styles.footer}>
          {`Custom names can be up to ${CUSTOM_CRITERION_MAX_NAME_LENGTH} characters. Disabled criteria are hidden when writing and viewing reviews.`}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GustraColors.cream,
  },
  content: {
    paddingHorizontal: Theme.spacing.listRowHorizontal,
    paddingTop: 16,
    gap: 12,
  },
  card: {
    backgroundColor: 'rgba(236, 227, 207, 0.55)',
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(35, 32, 26, 0.1)',
  },
  rowTitle: {
    ...bodyTextStyle,
    flex: 1,
    fontSize: 16,
    color: GustraColors.ink,
  },
  customName: {
    flexShrink: 1,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: GustraColors.ink,
    paddingVertical: 8,
  },
  addButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: GustraColors.forestGreen,
  },
  footer: {
    ...captionTextStyle,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(35, 32, 26, 0.55)',
    paddingHorizontal: 4,
  },
  pressed: {
    opacity: 0.7,
  },
});
