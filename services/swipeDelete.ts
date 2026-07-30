import { Alert, Platform } from 'react-native';

import { houseAlert } from '@/components/ui/HouseAlert';
import { showHouseUndoSnackbar } from '@/components/ui/HouseUndoSnackbar';
import { i18n } from '@/i18n';
import { Haptics } from '@/services/haptics';

export type SwipeDeleteRequest = {
  /** iOS / web confirm title. */
  title: string;
  /** iOS / web confirm body. */
  message: string;
  /** Android snackbar copy while Undo is available. */
  undoMessage: string;
  /** Persist the deletion (iOS after confirm; Android after snackbar timeout). */
  onCommit: () => void;
  /** Android: hide the row immediately (optimistic). */
  onHide?: () => void;
  /** Android: restore the row if the user taps Undo. */
  onRestore?: () => void;
};

/**
 * Platform delete after swipe:
 * - iOS: system `Alert` (UIKit), then commit.
 * - Android: hide immediately + Undo snackbar, commit when window expires.
 * - Web: house alert (no system Alert chrome).
 */
export function requestSwipeDelete(request: SwipeDeleteRequest): void {
  if (Platform.OS === 'android') {
    Haptics.warning();
    request.onHide?.();
    showHouseUndoSnackbar({
      message: request.undoMessage,
      actionLabel: i18n.t('common.undo'),
      durationMs: 4500,
      onUndo: () => {
        request.onRestore?.();
      },
      onCommit: () => {
        request.onCommit();
      },
    });
    return;
  }

  if (Platform.OS === 'ios') {
    Haptics.warning();
    Alert.alert(request.title, request.message, [
      { text: i18n.t('common.cancel'), style: 'cancel' },
      {
        text: i18n.t('common.delete'),
        style: 'destructive',
        onPress: () => {
          request.onCommit();
        },
      },
    ]);
    return;
  }

  houseAlert(request.title, request.message, [
    { text: i18n.t('common.cancel'), style: 'cancel' },
    {
      text: i18n.t('common.delete'),
      style: 'destructive',
      onPress: () => {
        request.onCommit();
      },
    },
  ]);
}
