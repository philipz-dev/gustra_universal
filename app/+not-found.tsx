import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { SerifText } from '@/components/ui/SerifText';
import { GustraColors } from '@/constants/Colors';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <SerifText size={22} weight="semibold" style={styles.title}>
          This screen doesn't exist.
        </SerifText>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Back to Memories</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: GustraColors.cream,
  },
  title: {
    color: GustraColors.ink,
    textAlign: 'center',
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: 14,
    color: GustraColors.forestGreen,
    fontWeight: '600',
  },
});
