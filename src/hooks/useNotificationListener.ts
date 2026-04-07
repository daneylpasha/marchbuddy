import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import type { EventSubscription } from 'expo-modules-core';
import { useNotificationStore } from '../store/notificationStore';
import { navigate } from '../navigation/navigationRef';

/**
 * Hook to listen for notification responses (user tapping a notification).
 * Should be mounted once at the app root level.
 */
export function useNotificationListener() {
  const responseListener = useRef<EventSubscription | null>(null);
  const lastNotificationListener = useRef<EventSubscription | null>(null);
  const setLastNotificationTap = useNotificationStore((s) => s.setLastNotificationTap);

  useEffect(() => {
    // Listen for notification taps (user opens notification)
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        const type = data?.type as string | undefined;
        const sessionKey = data?.sessionKey as string | undefined;

        setLastNotificationTap({ sessionKey, type });

        // Navigate to the Today tab (Run) when tapping a session notification
        if (type === 'A' || type === 'B') {
          navigate('Run');
        }
      });

    // Listen for notifications received while app is in foreground
    lastNotificationListener.current =
      Notifications.addNotificationReceivedListener(() => {
        // Notification received in foreground — banner is shown by the handler
      });

    return () => {
      responseListener.current?.remove();
      lastNotificationListener.current?.remove();
    };
  }, [setLastNotificationTap]);
}
