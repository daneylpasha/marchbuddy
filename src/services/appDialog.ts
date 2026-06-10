// Global imperative dialog API — drop-in replacement for React Native's
// Alert.alert that renders our themed AppDialogHost instead of the OS alert.
//
// Usage mirrors Alert.alert exactly:
//   showAppDialog('Title');
//   showAppDialog('Title', 'Message');
//   showAppDialog('Title', 'Message', [
//     { text: 'Cancel', style: 'cancel' },
//     { text: 'Delete', style: 'destructive', onPress: () => {...} },
//   ]);

import { create } from 'zustand';

export type AppDialogButtonStyle = 'default' | 'cancel' | 'destructive';

export interface AppDialogButton {
  text: string;
  onPress?: () => void;
  style?: AppDialogButtonStyle;
}

export interface AppDialogState {
  visible: boolean;
  title: string;
  message?: string;
  buttons: AppDialogButton[];
  show: (title: string, message?: string, buttons?: AppDialogButton[]) => void;
  hide: () => void;
}

export const useAppDialogStore = create<AppDialogState>((set) => ({
  visible: false,
  title: '',
  message: undefined,
  buttons: [{ text: 'OK' }],
  show: (title, message, buttons) =>
    set({
      visible: true,
      title,
      message,
      buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }],
    }),
  hide: () => set({ visible: false }),
}));

/**
 * Show the themed app dialog. Matches Alert.alert signature so call sites
 * can swap `Alert.alert(...)` for `showAppDialog(...)` with no other change.
 */
export function showAppDialog(
  title: string,
  message?: string,
  buttons?: AppDialogButton[],
): void {
  useAppDialogStore.getState().show(title, message, buttons);
}
