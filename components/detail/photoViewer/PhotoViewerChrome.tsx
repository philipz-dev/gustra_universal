import type { ReactNode } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import Animated, {
  type SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GustraColors } from '@/constants/Colors';
import { PhotoViewerStyle } from '@/constants/PhotoViewerStyle';

function presentPhotoOptions(args: {
  onShare: () => void;
  onSave: () => void;
}): void {
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Save to Photos', 'Share photo', 'Cancel'],
        cancelButtonIndex: 2,
      },
      (buttonIndex) => {
        if (buttonIndex === 0) args.onSave();
        if (buttonIndex === 1) args.onShare();
      },
    );
    return;
  }

  // Android Alert stacks buttons bottom→top relative to this array.
  Alert.alert('Photo options', undefined, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Share photo', onPress: args.onShare },
    { text: 'Save to Photos', onPress: args.onSave },
  ]);
}

type ChromeButtonProps = {
  iosName: string;
  androidName: keyof typeof MaterialIcons.glyphMap;
  accessibilityLabel: string;
  onPress: () => void;
};

/** Frosted circular chrome control (Swift `PhotoViewerChromeButton`). */
export function PhotoViewerChromeButton({
  iosName,
  androidName,
  accessibilityLabel,
  onPress,
}: ChromeButtonProps) {
  const color = PhotoViewerStyle.chromeForeground;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      style={({ pressed }) => [styles.chromeHit, pressed && styles.pressed]}>
      <View
        style={[
          styles.chromeGlyph,
          PhotoViewerStyle.isEnabled
            ? styles.chromeGlyphCinematic
            : styles.chromeGlyphHouse,
        ]}>
        {Platform.OS === 'ios' ? (
          <SymbolView
            name={iosName as never}
            tintColor={color}
            size={17}
            weight="semibold"
          />
        ) : (
          <MaterialIcons name={androidName} size={20} color={color} />
        )}
      </View>
    </Pressable>
  );
}

type TopBarProps = {
  onClose: () => void;
  onShare: () => void;
  onSave: () => void;
  title?: string;
  showTitle?: boolean;
};

/** Top gradient + close / options (Swift `PhotoViewerTopBar`). */
export function PhotoViewerTopBar({
  onClose,
  onShare,
  onSave,
  title,
  showTitle = false,
}: TopBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.topBar,
        { paddingTop: insets.top + 12 },
        !PhotoViewerStyle.isEnabled && styles.topBarHouse,
      ]}
      pointerEvents="box-none">
      {PhotoViewerStyle.isEnabled ? (
        <LinearGradient
          colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0)']}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}

      <View style={styles.topRow}>
        <PhotoViewerChromeButton
          iosName="xmark"
          androidName="close"
          accessibilityLabel="Close"
          onPress={onClose}
        />

        <View style={styles.titleSlot}>
          {showTitle && title ? (
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
        </View>

        <PhotoViewerChromeButton
          iosName="ellipsis"
          androidName="more-horiz"
          accessibilityLabel="Photo options"
          onPress={() =>
            presentPhotoOptions({
              onShare,
              onSave,
            })
          }
        />
      </View>
    </View>
  );
}

type CountPillProps = {
  text: string;
  visible?: boolean;
  dismissY?: SharedValue<number>;
};

/** Bottom counter / caption pill (Swift `PhotoViewerCountPill`). */
export function PhotoViewerCountPill({
  text,
  visible = true,
  dismissY,
}: CountPillProps) {
  const insets = useSafeAreaInsets();
  const fadeStyle = useAnimatedStyle(() => {
    if (!dismissY) return { opacity: 1 };
    const progress = Math.min(
      1,
      Math.abs(dismissY.value) / PhotoViewerStyle.dismissThreshold,
    );
    return { opacity: 1 - progress };
  });

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.pillWrap,
        { paddingBottom: insets.bottom + 28 },
        fadeStyle,
      ]}
      pointerEvents="none">
      <View style={styles.pill}>
        <Text style={styles.pillText}>{text}</Text>
      </View>
    </Animated.View>
  );
}

export function PhotoViewerShell({
  children,
  dismissY,
}: {
  children: ReactNode;
  dismissY?: SharedValue<number>;
}) {
  const backdropStyle = useAnimatedStyle(() => {
    if (!dismissY) return { opacity: 1 };
    const progress = Math.min(
      1,
      Math.abs(dismissY.value) / PhotoViewerStyle.dismissThreshold,
    );
    return { opacity: 1 - progress * 0.35 };
  });

  return (
    <View style={styles.shell}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: PhotoViewerStyle.backdrop },
          backdropStyle,
        ]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: '#000',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingHorizontal: 16,
    paddingBottom: 10,
    overflow: 'hidden',
  },
  topBarHouse: {
    backgroundColor: GustraColors.forestGreen,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  titleSlot: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    color: PhotoViewerStyle.chromeForeground,
    fontSize: 15,
    fontWeight: '600',
  },
  chromeHit: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chromeGlyph: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chromeGlyphCinematic: {
    backgroundColor: PhotoViewerStyle.chromeButtonFill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  chromeGlyphHouse: {
    backgroundColor: 'transparent',
  },
  pressed: {
    opacity: 0.7,
  },
  pillWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: PhotoViewerStyle.pillBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  pillText: {
    color: PhotoViewerStyle.pillForeground,
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
