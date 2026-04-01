import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useNotificationStore } from '../store/notificationStore';
import { supabase } from '../api/supabase';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Request notification permissions with the OS dialog.
 * Returns the permission status.
 */
export async function requestPermissions(): Promise<'granted' | 'denied'> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  if (existingStatus === 'granted') {
    useNotificationStore.getState().setPermissionStatus('granted');
    return 'granted';
  }

  const { status } = await Notifications.requestPermissionsAsync();
  const result = status === 'granted' ? 'granted' : 'denied';
  useNotificationStore.getState().setPermissionStatus(result);
  useNotificationStore.getState().setLastPermissionPrompt(new Date().toISOString());
  return result;
}

/**
 * Register for push notifications, get the Expo push token,
 * and save it to the user's Supabase profile.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  const permission = await requestPermissions();
  if (permission !== 'granted') return null;

  // Android needs a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#10B981',
    });
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    useNotificationStore.getState().setExpoPushToken(token);

    // Save to Supabase profile
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('profiles')
        .update({
          expo_push_token: token,
          notification_permission: 'granted',
        })
        .eq('id', user.id);
    }

    return token;
  } catch (error) {
    console.error('Failed to get push token:', error);
    return null;
  }
}

/**
 * Schedule a local notification for a session reminder (Type A).
 * Returns the notification ID so it can be cancelled later.
 */
export async function scheduleSessionReminder(
  sessionTitle: string,
  scheduledAt: Date,
  userName: string,
): Promise<string | null> {
  const { permissionStatus } = useNotificationStore.getState();
  if (permissionStatus !== 'granted') return null;

  // Schedule 30 minutes before
  const triggerDate = new Date(scheduledAt.getTime() - 30 * 60 * 1000);

  // Don't schedule if trigger is in the past
  if (triggerDate <= new Date()) return null;

  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Session Reminder',
        body: `Hey ${userName}! Your ${sessionTitle} starts in 30 minutes. Lace up!`,
        data: { type: 'A', sessionTitle },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });
    return notificationId;
  } catch (error) {
    console.error('Failed to schedule reminder:', error);
    return null;
  }
}

/**
 * Cancel a previously scheduled local notification.
 */
export async function cancelScheduledNotification(
  notificationId: string,
): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (error) {
    console.error('Failed to cancel notification:', error);
  }
}

/**
 * Pool of missed session messages (Type B) — soft, no guilt.
 */
export const MISSED_SESSION_MESSAGES = [
  "No worries, {{name}}. Life happens. Your session is still here when you're ready.",
  "Missed today's session? That's okay — tomorrow is a clean slate.",
  "Even a 5-minute walk counts. We're not keeping score here.",
  "Hey {{name}}, no stress. Rest is part of the process too.",
  "Skipped today? No big deal. Show up when you can, {{name}}.",
  "{{name}}, your session will be waiting. No judgment, no pressure.",
];

/**
 * Pool of re-engagement messages (Type C) — escalate gently by day.
 */
export const REENGAGEMENT_MESSAGES_DAY2 = [
  "Hey {{name}}, just checking in. Your body misses moving.",
  "{{name}}, two days off. Sometimes that's exactly what you need.",
];

export const REENGAGEMENT_MESSAGES_DAY3 = [
  "Two days off. That's totally valid. Ready to shake it off?",
  "Hey {{name}}, when you're ready, your next session is waiting.",
];

export const REENGAGEMENT_MESSAGES_DAY4_PLUS = [
  "The hardest part is starting. You've done it before. You can again.",
  "A 10-minute walk today could change your entire afternoon.",
  "{{name}}, your future self is waiting at the finish line.",
  "Progress isn't linear. But showing up always counts.",
  "Small steps, {{name}}. That's all it takes to get back.",
  "You don't need motivation. You just need to start. We'll handle the rest.",
  "{{name}}, one session. That's it. Just one to break the streak.",
  "Remember why you started, {{name}}. That reason hasn't changed.",
  "Your running shoes miss you, {{name}}. Just saying.",
  "Three minutes of walking > zero minutes of anything. Let's go, {{name}}.",
];
