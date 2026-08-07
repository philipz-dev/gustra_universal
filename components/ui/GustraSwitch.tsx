import {
  Platform,
  Switch,
  type SwitchProps,
  StyleSheet,
  View,
} from 'react-native';
import { Switch as PaperSwitch } from 'react-native-paper';

import { GustraColors } from '@/constants/Colors';
import { Haptics } from '@/services/haptics';

type GustraSwitchProps = Omit<
  SwitchProps,
  'trackColor' | 'thumbColor' | 'ios_backgroundColor'
>;

/**
 * House-styled toggle.
 * - iOS: native UISwitch with the Gustra track colors + selection haptic.
 * - Android: M3 Switch (react-native-paper) — correct 52dp touch target and
 *   state layer, colored via the Gustra MD3 theme instead of a scaled native
 *   switch. The M3 switch is smaller, so wrap it in a centered hit-area box.
 */
export function GustraSwitch({ onValueChange, ...props }: GustraSwitchProps) {
  if (Platform.OS === 'android') {
    return (
      <View style={styles.androidHitArea} pointerEvents="box-none">
        <PaperSwitch
          value={props.value}
          onValueChange={(value) => {
            Haptics.selectionChanged();
            onValueChange?.(value);
          }}
          disabled={props.disabled}
          style={[styles.androidSwitch, props.style]}
        />
      </View>
    );
  }

  return (
    <Switch
      {...props}
      trackColor={{
        false: 'rgba(35, 32, 26, 0.15)',
        true: GustraColors.forestGreen,
      }}
      thumbColor="#FFFFFF"
      ios_backgroundColor="rgba(35, 32, 26, 0.15)"
      onValueChange={(value) => {
        Haptics.selectionChanged();
        onValueChange?.(value);
      }}
    />
  );
}

const styles = StyleSheet.create({
  androidHitArea: {
    minWidth: 52,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  androidSwitch: {
    transform: [{ scale: 1.05 }],
  },
});
