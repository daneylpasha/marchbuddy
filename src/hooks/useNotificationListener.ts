import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import type { EventSubscription } from 'expo-modules-core';
import { useNotificationStore } from '../store/notificationStore';

/**
 * Hook to listen for notification responses (user tapping a notification).
 * Should be mounted once at the app root level.
 */
export function useNotificationListener(
  onSessionTap?: (sessionKey: string) => void,
) {
  const responseListener = useRef<EventSubscription | null>(null);
  const setLastNotificationTap = useNotificationStore((s) => s.setLastNotificationTap);

  useEffect(() => {
    // Listen for notification taps
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        const type = data?.type as string | undefined;
        const sessionKey = data?.sessionKey as string | undefined;

        setLastNotificationTap({
          sessionKey,
          type,
        });

        // If tapping a session-related notification, navigate to it
        if (sessionKey && onSessionTap) {
          onSessionTap(sessionKey);
        }
      });

    return () => {
      responseListener.current?.remove();
    };
  }, [onSessionTap, setLastNotificationTap]);
}
