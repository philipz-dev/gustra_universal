import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HousePrimaryButton } from '@/components/ui/HousePrimaryButton';
import { GustraColors } from '@/constants/Colors';
import { Theme, bodyTextStyle } from '@/constants/Theme';

type PhotoSourceChooserBodyProps = {
  title: string;
  isImporting?: boolean;
  onTakePhoto: () => void;
  onImportPhoto: () => void;
};

/**
 * House-style Take / Import chooser content
 * — Swift `PhotoSourceChooserView` body.
 */
export function PhotoSourceChooserBody({
  title,
  isImporting = false,
  onTakePhoto,
  onImportPhoto,
}: PhotoSourceChooserBodyProps) {
  return (
    <View
      style={styles.body}
      accessibilityLabel={isImporting ? 'Adding photos…' : title}>
      <View style={styles.iconCircle}>
        {isImporting ? (
          <ActivityIndicator color={GustraColors.forestGreen} size="large" />
        ) : (
          <SymbolView
            name={{
              ios: 'camera.fill',
              android: 'photo_camera',
              web: 'photo_camera',
            }}
            size={36}
            tintColor={GustraColors.forestGreen}
          />
        )}
      </View>

      {isImporting ? (
        <Text style={styles.importingLabel}>Adding photos…</Text>
      ) : (
        <>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.actions}>
            <HousePrimaryButton title="Take Photo" onPress={onTakePhoto} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Import Photo"
              onPress={onImportPhoto}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.secondaryLabel}>Import Photo</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

type PhotoSourceChooserModalProps = PhotoSourceChooserBodyProps & {
  visible: boolean;
  onClose: () => void;
};

/**
 * Full-screen cream chooser sheet (Swift `PhotoSourceChooserView` + toolbar close).
 */
export function PhotoSourceChooserModal({
  visible,
  title,
  isImporting = false,
  onClose,
  onTakePhoto,
  onImportPhoto,
}: PhotoSourceChooserModalProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => {
        if (!isImporting) onClose();
      }}>
      <View
        style={[
          styles.screen,
          {
            paddingTop: Math.max(insets.top, 12),
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}>
        <View style={styles.toolbar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={8}
            disabled={isImporting}
            onPress={onClose}
            style={({ pressed }) => [
              styles.closeBtn,
              isImporting && styles.closeDisabled,
              pressed && !isImporting && styles.pressed,
            ]}>
            <SymbolView
              name={{
                ios: 'xmark.circle.fill',
                android: 'cancel',
                web: 'cancel',
              }}
              size={30}
              tintColor={GustraColors.forestGreen}
            />
          </Pressable>
        </View>
        <PhotoSourceChooserBody
          title={title}
          isImporting={isImporting}
          onTakePhoto={onTakePhoto}
          onImportPhoto={onImportPhoto}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GustraColors.cream,
  },
  toolbar: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    alignItems: 'flex-start',
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeDisabled: {
    opacity: 0.35,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 16,
    paddingBottom: Theme.spacing.floatingTabBarClearance,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(36, 78, 57, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    ...bodyTextStyle,
    fontSize: 18,
    fontWeight: '600',
    color: GustraColors.forestGreen,
    textAlign: 'center',
    marginBottom: 8,
  },
  importingLabel: {
    ...bodyTextStyle,
    fontSize: 17,
    fontWeight: '600',
    color: GustraColors.ink,
    textAlign: 'center',
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  secondaryButton: {
    width: '100%',
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(36, 78, 57, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: GustraColors.forestGreen,
  },
  pressed: {
    opacity: 0.75,
  },
});
