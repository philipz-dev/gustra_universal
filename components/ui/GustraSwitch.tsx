import {
  Platform,
  Switch,
  type SwitchProps,
  StyleSheet,
} from 'react-native';

import { GustraColors } from '@/constants/Colors';
import { Haptics } from '@/services/haptics';

/** Android Material switches render smaller than iOS UISwitch; scale to match. */
const ANDROID_SCALE = 1.28;

type GustraSwitchProps = Omit<
  SwitchProps,
  'trackColor' | 'thumbColor' | 'ios_backgroundColor'
>;

/** House-styled toggle; enlarged on Android so it reads like the iOS control. */
export function GustraSwitch({ onValueChange, ...props }: GustraSwitchProps) {
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
      style={[
        Platform.OS === 'android' ? styles.androidScale : null,
        props.style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  androidScale: {
    transform: [{ scale: ANDROID_SCALE }],
  },
});
