import { StyleSheet, View } from 'react-native';

import { HouseEmptyState } from '@/components/ui/HouseEmptyState';
import { GustraColors } from '@/constants/Colors';

export default function MapShellScreen() {
  return (
    <View style={styles.screen}>
      <HouseEmptyState
        title="My map"
        description="Your restaurant pins will live here — same cream canvas as iOS. Map coming in a later pass."
        systemImage="map"
        androidImage="map"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GustraColors.cream,
    paddingBottom: 96,
  },
});

