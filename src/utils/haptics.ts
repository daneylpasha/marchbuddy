import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '../store/settingsStore';

const isEnabled = (): boolean => useSettingsStore.getState().hapticFeedbackEnabled;

export const hapticImpact = async (
  style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium,
): Promise<void> => {
  if (!isEnabled()) return;
  try {
    await Haptics.impactAsync(style);
  } catch {}
};

export const hapticNotification = async (
  type: Haptics.NotificationFeedbackType = Haptics.NotificationFeedbackType.Success,
): Promise<void> => {
  if (!isEnabled()) return;
  try {
    await Haptics.notificationAsync(type);
  } catch {}
};

export const hapticSelection = async (): Promise<void> => {
  if (!isEnabled()) return;
  try {
    await Haptics.selectionAsync();
  } catch {}
};

// Re-export style enums so callers don't need a separate Haptics import.
export const HapticImpactStyle = Haptics.ImpactFeedbackStyle;
export const HapticNotificationType = Haptics.NotificationFeedbackType;
