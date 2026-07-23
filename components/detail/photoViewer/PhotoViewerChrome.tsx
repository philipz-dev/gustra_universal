import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

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

type ChromeButtonProps = {
  iosName: string;
  androidName: keyof typeof MaterialIcons.glyphMap;
  accessibilityLabel: string;
  onPress: () => void;
  /** Glyph point size (default 17 iOS / 20 Android). */
  iconSize?: number;
};

/** Frosted circular chrome control (Swift `PhotoViewerChromeButton`). */
export function PhotoViewerChromeButton({
  iosName,
  androidName,
  accessibilityLabel,
  onPress,
  iconSize,
}: ChromeButtonProps) {
  const color = PhotoViewerStyle.chromeForeground;
  const iosSize = iconSize ?? 17;
  const androidSize = iconSize ?? 20;
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
            size={iosSize}
            weight="bold"
          />
        ) : (
          <MaterialIcons name={androidName} size={androidSize} color={color} />
        )}
      </View>
    </Pressable>
  );
}

type TopBarProps = {
  onClose: () => void;
  /** Opens the system share sheet directly (no intermediate options menu). */
  onShare: () => void;
  /** Save current photo to the device library (Swift `Save to Photos`). */
  onSave?: () => void;
  title?: string;
  showTitle?: boolean;
};

/** Top gradient + close / save / share. */
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

        <View style={styles.trailingActions}>
          {onSave ? (
            <PhotoViewerChromeButton
              iosName="square.and.arrow.down"
              androidName="file-download"
              accessibilityLabel="Save to Photos"
              iconSize={22}
              onPress={onSave}
            />
          ) : null}
          <PhotoViewerChromeButton
            // iOS share glyph; Android `share` is the 3-dot network icon — use ios_share.
            iosName="square.and.arrow.up"
            androidName="ios-share"
            accessibilityLabel="Share photo"
            iconSize={22}
            onPress={onShare}
          />
        </View>
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
  trailingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
