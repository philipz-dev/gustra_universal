import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SerifText } from '@/components/ui/SerifText';
import { GustraColors } from '@/constants/Colors';
import { bodyTextStyle, Theme } from '@/constants/Theme';
import { Haptics } from '@/services/haptics';

export type HouseAlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

export type HouseAlertRequest = {
  title: string;
  message?: string;
  buttons: HouseAlertButton[];
};

type Listener = (request: HouseAlertRequest | null) => void;

let listener: Listener | null = null;
let queue: HouseAlertRequest[] = [];

function publish(request: HouseAlertRequest | null) {
  listener?.(request);
}

function normalizeButtons(
  buttons?: HouseAlertButton[],
): HouseAlertButton[] {
  if (!buttons || buttons.length === 0) {
    return [{ text: 'OK', style: 'default' }];
  }
  return buttons;
}

/**
 * House-styled replacement for React Native `Alert.alert`
 * (cream card / action sheet — avoids the bare Android system dialog).
 */
export function houseAlert(
  title: string,
  message?: string,
  buttons?: HouseAlertButton[],
): void {
  const request: HouseAlertRequest = {
    title,
    message,
    buttons: normalizeButtons(buttons),
  };
  if (!listener) {
    queue.push(request);
    return;
  }
  publish(request);
}

function subscribe(next: Listener): () => void {
  listener = next;
  if (queue.length > 0) {
    const pending = queue.shift()!;
    publish(pending);
  }
  return () => {
    if (listener === next) listener = null;
  };
}

function isActionSheet(buttons: HouseAlertButton[]): boolean {
  const actionable = buttons.filter((b) => b.style !== 'cancel');
  if (actionable.length >= 3) return true;
  // Two non-destructive choices (e.g. Take Photo / Library, map apps).
  if (
    actionable.length >= 2 &&
    !actionable.some((b) => b.style === 'destructive')
  ) {
    return true;
  }
  return false;
}

/**
 * Root host — mount once under the app providers.
 */
export function HouseAlertHost() {
  const insets = useSafeAreaInsets();
  const [request, setRequest] = useState<HouseAlertRequest | null>(null);

  useEffect(() => {
    return subscribe((next) => {
      setRequest(next);
      if (next) {
        const destructive = next.buttons.some((b) => b.style === 'destructive');
        if (destructive) Haptics.warning();
        else Haptics.light();
      }
    });
  }, []);

  const dismiss = () => {
    setRequest(null);
    if (queue.length > 0) {
      const next = queue.shift()!;
      // Allow current modal to unmount before showing the next.
      requestAnimationFrame(() => publish(next));
    }
  };

  const runButton = (button: HouseAlertButton) => {
    if (button.style === 'cancel') Haptics.light();
    else if (button.style === 'destructive') Haptics.warning();
    else Haptics.selectionChanged();
    dismiss();
    // Defer so the modal can close before navigation / another alert.
    requestAnimationFrame(() => {
      button.onPress?.();
    });
  };

  if (!request) return null;

  const { title, message, buttons } = request;
  const sheet = isActionSheet(buttons);
  const cancel = buttons.find((b) => b.style === 'cancel');
  const others = buttons.filter((b) => b.style !== 'cancel');
  // Keep destructive last among actions (iOS-like).
  const orderedOthers = [...others].sort((a, b) => {
    if (a.style === 'destructive' && b.style !== 'destructive') return 1;
    if (b.style === 'destructive' && a.style !== 'destructive') return -1;
    return 0;
  });

  const onBackdrop = () => {
    if (cancel) runButton(cancel);
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (cancel) runButton(cancel);
        else dismiss();
      }}>
      <View style={sheet ? styles.backdropSheet : styles.backdropCard}>
        <Pressable style={styles.dismissArea} onPress={onBackdrop} />

        {sheet ? (
          <View
            style={[
              styles.sheet,
              { paddingBottom: Math.max(insets.bottom, 16) + 8 },
            ]}>
            <View style={styles.handle} />
            <SerifText size={22} weight="semibold" style={styles.title}>
              {title}
            </SerifText>
            {message ? <Text style={styles.message}>{message}</Text> : null}
            <View style={styles.sheetActions}>
              {orderedOthers.map((button) => (
                <Pressable
                  key={button.text}
                  accessibilityRole="button"
                  onPress={() => runButton(button)}
                  style={({ pressed }) => [
                    styles.sheetRow,
                    button.style === 'destructive' && styles.sheetRowDestructive,
                    pressed && styles.pressed,
                  ]}>
                  <Text
                    style={[
                      styles.sheetRowLabel,
                      button.style === 'destructive' &&
                        styles.sheetRowLabelDestructive,
                    ]}>
                    {button.text}
                  </Text>
                </Pressable>
              ))}
            </View>
            {cancel ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => runButton(cancel)}
                style={({ pressed }) => [
                  styles.cancelPill,
                  pressed && styles.pressed,
                ]}>
                <Text style={styles.cancelPillLabel}>{cancel.text}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={styles.card}>
            <SerifText size={22} weight="semibold" style={styles.title}>
              {title}
            </SerifText>
            {message ? <Text style={styles.message}>{message}</Text> : null}
            <View style={styles.cardActions}>
              {orderedOthers.map((button) => (
                <Pressable
                  key={button.text}
                  accessibilityRole="button"
                  onPress={() => runButton(button)}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    button.style === 'destructive'
                      ? styles.actionDestructive
                      : styles.actionPrimary,
                    pressed && styles.pressed,
                  ]}>
                  <Text
                    style={[
                      styles.actionLabel,
                      button.style === 'destructive'
                        ? styles.actionLabelOnDestructive
                        : styles.actionLabelOnPrimary,
                    ]}>
                    {button.text}
                  </Text>
                </Pressable>
              ))}
              {cancel ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => runButton(cancel)}
                  style={({ pressed }) => [
                    styles.cancelTextBtn,
                    pressed && styles.pressed,
                  ]}>
                  <Text style={styles.cancelTextLabel}>{cancel.text}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropCard: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: 'rgba(35, 32, 26, 0.45)',
  },
  backdropSheet: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(35, 32, 26, 0.45)',
  },
  dismissArea: {
    ...StyleSheet.absoluteFill,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    backgroundColor: GustraColors.cream,
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
    gap: 10,
    zIndex: 1,
  },
  title: {
    color: GustraColors.ink,
  },
  message: {
    ...bodyTextStyle,
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(35, 32, 26, 0.72)',
  },
  cardActions: {
    marginTop: 10,
    gap: 10,
  },
  actionBtn: {
    borderRadius: Theme.radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  actionPrimary: {
    backgroundColor: GustraColors.forestGreen,
  },
  actionDestructive: {
    backgroundColor: GustraColors.ratingAvoid,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  actionLabelOnPrimary: {
    color: '#FFFFFF',
  },
  actionLabelOnDestructive: {
    color: '#FFFFFF',
  },
  cancelTextBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelTextLabel: {
    ...bodyTextStyle,
    fontSize: 16,
    color: 'rgba(35, 32, 26, 0.55)',
  },
  sheet: {
    backgroundColor: GustraColors.cream,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(35, 32, 26, 0.18)',
    marginBottom: 10,
  },
  sheetActions: {
    marginTop: 8,
    gap: 8,
  },
  sheetRow: {
    backgroundColor: GustraColors.bubble,
    borderRadius: Theme.radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  sheetRowDestructive: {
    backgroundColor: 'rgba(199, 71, 66, 0.14)',
  },
  sheetRowLabel: {
    ...bodyTextStyle,
    fontSize: 16,
    fontWeight: '600',
    color: GustraColors.ink,
  },
  sheetRowLabelDestructive: {
    color: GustraColors.ratingAvoid,
  },
  cancelPill: {
    marginTop: 10,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: Theme.radius.lg,
    backgroundColor: 'rgba(35, 32, 26, 0.06)',
  },
  cancelPillLabel: {
    ...bodyTextStyle,
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(35, 32, 26, 0.65)',
  },
  pressed: {
    opacity: 0.75,
  },
});
