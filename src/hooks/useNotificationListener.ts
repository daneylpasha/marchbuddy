import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import type { EventSubscription } from 'expo-modules-core';
import { useNotificationStore } from '../store/notificationStore';
import { navigate } from '../navigation/navigationRef';
import {
  logLocalReceived,
  type NotificationKind,
} from '../services/notifications/NotificationManager';

/**
 * Hook to listen for notification responses (user tapping) and for
 * notifications received while the app is foregrounded.
 *
 * Two concerns wired here:
 *
 *   1. Deep linking (P3 item #9)
 *      We stamp sessionKey onto Type-A payloads when scheduling; this
 *      listener captures it into notificationStore.lastNotificationTap
 *      so the Run stack (specifically TodayScreen) can auto-open the
 *      matching session. We keep the actual SessionDetail navigation
 *      in the screen layer because the tap listener doesn't have easy
 *      access to the SessionPlan needed to hydrate that screen.
 *
 *   2. Unified logging (P2 item #5)
 *      When a local Type-A notification fires, we write a row into
 *      notification_log with source='local'. That way the server's
 *      daily rate-limit query actually reflects the full volume the
 *      user is receiving (local + push) instead of just push.
 */
export function useNotificationListener() {
  const responseListener = useRef<EventSubscription | null>(null);
  const receivedListener = useRef<EventSubscription | null>(null);
  const setLastNotificationTap = useNotificationStore((s) => s.setLastNotificationTap);

  useEffect(() => {
    // ── Tap handler ─────────────────────────────────────────────────────
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as
        | { type?: string; sessionKey?: string; sessionTitle?: string; trigger?: string; schedule_id?: string; event?: string }
        | undefined;

      const type = data?.type;
      const sessionKey = data?.sessionKey;

      // Persist tap context so downstream screens can deep-link.
      setLastNotificationTap({ sessionKey, type });

      // Buddy Codes — route to Buddy tab for buddy-related events
      if (data?.event === 'buddy_request_received' || data?.event === 'buddy_request_accepted') {
        navigate('Buddy');
        return;
      }

      // V2 Proactive Coach Messages — route to Coach tab and forward the
      // schedule_id so CoachChatScreen can fire `coach_message_opened`.
      if (type === 'proactive_coach') {
        navigate('Coach', { fromProactive: true, scheduleId: data?.schedule_id });
        return;
      }

      if (type === 'A' || type === 'B' || type === 'C' || sessionKey) {
        navigate('Run');
      }
    });

    // ── Received handler ───────────────────────────────────────────────
    receivedListener.current = Notifications.addNotificationReceivedListener((notification) => {
      const content = notification.request.content;
      const data = content.data as { type?: NotificationKind; sessionKey?: string } | undefined;

      // Only log Type-A here (push B/C are logged server-side).
      if (data?.type === 'A') {
        void logLocalReceived({
          type: 'A',
          message: content.body ?? content.title ?? 'Session reminder',
        });
      }
    });

    return () => {
      responseListener.current?.remove();
      receivedListener.current?.remove();
    };
  }, [setLastNotificationTap]);
}
