import { type RefObject } from 'react';
import { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { analytics, EVENTS } from '../services/analytics';
import { showAppDialog } from '../services/appDialog';

export type ShareSurface = 'pr' | 'level_up' | 'session';

/**
 * Captures a ShareCard ref as a PNG and opens the native share sheet.
 * Fires share_button_tapped → share_sheet_opened → share_completed.
 *
 * Note on caption / dialogTitle: appears in the Android share sheet dialog
 * only. iOS share targets (WhatsApp, iMessage, Instagram, etc.) ignore
 * dialogTitle — the image must speak for itself on iOS.
 *
 * Note on dismissal tracking: expo-sharing does not distinguish completion
 * from dismissal on either platform. share_completed fires on both. There
 * is intentionally no share_sheet_dismissed event.
 */
export async function shareCelebrationCard(
  cardRef: RefObject<View | null>,
  caption: string,
  surface: ShareSurface,
): Promise<void> {
  analytics.track(EVENTS.share_button_tapped, { surface });

  let uri: string;
  try {
    uri = await captureRef(cardRef, { format: 'png', quality: 1 });
  } catch {
    analytics.track(EVENTS.share_sheet_opened, { result: 'failure', surface });
    showAppDialog("Couldn't generate share card, try again");
    return;
  }

  const available = await Sharing.isAvailableAsync();
  if (!available) {
    showAppDialog('Sharing not available on this device');
    return;
  }

  analytics.track(EVENTS.share_sheet_opened, { result: 'success', surface });
  await Sharing.shareAsync(uri, {
    mimeType: 'image/png',
    dialogTitle: caption,
  });
  analytics.track(EVENTS.share_completed, { surface, destination_app: null });
}
