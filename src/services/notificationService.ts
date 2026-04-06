import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useNotificationStore } from '../store/notificationStore';
import { supabase } from '../api/supabase';

// Configure notification behavior — shows banner even when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Ensure Android notification channels exist.
 * Must be called before scheduling any notification.
 */
async function ensureChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('session-reminders', {
    name: 'Session Reminders',
    description: 'Reminders for your scheduled sessions',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#10B981',
    sound: 'default',
  });

  await Notifications.setNotificationChannelAsync('default', {
    name: 'General',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
  });
}

/**
 * Request notification permissions with the OS dialog.
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

  await ensureChannels();

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '068b87b8-7c39-40b5-af36-e4ced0a3c81e',
    });
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
    // Push token fails on simulators — that's fine, local notifications still work
    return null;
  }
}

/**
 * Schedule local notifications for a session reminder (Type A).
 * Schedules:
 *   1. At the exact scheduled time
 *   2. 30 minutes before (if far enough in the future)
 *
 * Returns comma-separated notification IDs for cancellation.
 */
export async function scheduleSessionReminder(
  sessionTitle: string,
  scheduledAt: Date,
  userName: string,
): Promise<string | null> {
  // Ensure permission
  let { permissionStatus } = useNotificationStore.getState();
  if (permissionStatus !== 'granted') {
    permissionStatus = await requestPermissions();
    if (permissionStatus !== 'granted') return null;
  }

  await ensureChannels();

  const now = new Date();
  const ids: string[] = [];
  const channelId = Platform.OS === 'android' ? 'session-reminders' : undefined;

  // 1. Notification at the exact scheduled time
  if (scheduledAt > now) {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: `Time for ${sessionTitle}!`,
          body: `${userName}, your session is starting now. Let's go!`,
          data: { type: 'A', sessionTitle },
          sound: true,
          ...(channelId && { channelId }),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: scheduledAt,
          channelId,
        },
      });
      ids.push(id);
    } catch (error) {
      console.error('Failed to schedule session notification:', error);
    }
  }

  // 2. Reminder 30 minutes before (only if >30 min away)
  const earlyDate = new Date(scheduledAt.getTime() - 30 * 60 * 1000);
  if (earlyDate > now) {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Session Reminder',
          body: `Hey ${userName}! Your ${sessionTitle} starts in 30 minutes. Lace up!`,
          data: { type: 'A', sessionTitle },
          sound: true,
          ...(channelId && { channelId }),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: earlyDate,
          channelId,
        },
      });
      ids.push(id);
    } catch (error) {
      console.error('Failed to schedule early reminder:', error);
    }
  }

  // Return all IDs joined — so we can cancel all of them later
  return ids.length > 0 ? ids.join(',') : null;
}

/**
 * Cancel previously scheduled local notifications.
 * Handles comma-separated IDs (multiple notifications per session).
 */
export async function cancelScheduledNotification(
  notificationId: string,
): Promise<void> {
  const ids = notificationId.split(',');
  for (const id of ids) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id.trim());
    } catch (error) {
      console.error('Failed to cancel notification:', error);
    }
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
