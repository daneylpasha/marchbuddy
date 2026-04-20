import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useNotificationStore } from '../store/notificationStore';
import { supabase } from '../api/supabase';
import {
  scheduleForSession as managerScheduleForSession,
  cancelByIds as managerCancelByIds,
  cancelForSession as managerCancelForSession,
} from './notifications/NotificationManager';

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
 * Best-effort device timezone (IANA, e.g. "Asia/Karachi"). Used by the
 * push Edge Function so quiet hours can be evaluated in user local time
 * instead of UTC. Falls back to 'UTC' if unavailable.
 */
function getDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
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

    // Save to Supabase profile (include device timezone so server-side
    // quiet hours work for this user).
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('profiles')
        .update({
          expo_push_token: token,
          notification_permission: 'granted',
          timezone: getDeviceTimezone(),
        })
        .eq('id', user.id);
    }

    return token;
  } catch (error) {
    // Push token fails on simulators/emulators without Play Services — that's fine, local notifications still work
    return null;
  }
}

/**
 * Refresh push token — call on every app open to keep token up to date.
 * Tokens can change after app reinstall, OS update, etc.
 */
export async function refreshPushToken(): Promise<void> {
  const { permissionStatus } = useNotificationStore.getState();
  if (permissionStatus !== 'granted') return;

  await ensureChannels();

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '068b87b8-7c39-40b5-af36-e4ced0a3c81e',
    });
    const newToken = tokenData.data;
    const currentToken = useNotificationStore.getState().expoPushToken;

    // Only update if token changed. We always refresh timezone though —
    // cheap and handles the case where the user travels or changes
    // device locale between sessions.
    const { data: { user } } = await supabase.auth.getUser();
    if (newToken && newToken !== currentToken) {
      useNotificationStore.getState().setExpoPushToken(newToken);
      if (user) {
        await supabase
          .from('profiles')
          .update({
            expo_push_token: newToken,
            timezone: getDeviceTimezone(),
          })
          .eq('id', user.id);
      }
    } else if (user) {
      await supabase
        .from('profiles')
        .update({ timezone: getDeviceTimezone() })
        .eq('id', user.id);
    }
  } catch {
    // Silently fail — simulators and some devices can't get tokens
  }
}

/**
 * Clear push token from server — call on logout/sign out.
 */
export async function clearPushToken(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('profiles')
        .update({ expo_push_token: null, notification_permission: 'undetermined' })
        .eq('id', user.id);
    }
  } catch {
    // Best-effort cleanup
  }

  useNotificationStore.getState().setExpoPushToken('');
  useNotificationStore.getState().setPermissionStatus('undetermined');
}

/**
 * Schedule local notifications for a session reminder (Type A).
 * Delegates to NotificationManager so that prefs, dedup, and the
 * sessionKey payload are all centralized.
 *
 * Signature note: sessionKey was added for deep-linking but is
 * optional to keep older call-sites working during the migration.
 * New code should always pass it.
 */
export async function scheduleSessionReminder(
  sessionTitle: string,
  scheduledAt: Date,
  userName: string,
  sessionKey?: string,
): Promise<string | null> {
  // Ensure permission prompt still happens from this entry point, as
  // callers relied on it previously.
  let { permissionStatus } = useNotificationStore.getState();
  if (permissionStatus !== 'granted') {
    permissionStatus = await requestPermissions();
    if (permissionStatus !== 'granted') return null;
  }

  return managerScheduleForSession({
    // Fallback: derive a stable key from title+time if the caller
    // didn't supply one. Old code paths won't break, but they also
    // won't get the dedup benefit — fine for the transition window.
    sessionKey: sessionKey ?? `${sessionTitle}:${scheduledAt.toISOString()}`,
    sessionTitle,
    scheduledAt,
    userName,
  });
}

/**
 * Cancel previously scheduled local notifications.
 * Handles comma-separated IDs (multiple notifications per session).
 */
export async function cancelScheduledNotification(
  notificationId: string,
): Promise<void> {
  await managerCancelByIds(notificationId);
}

/**
 * Defensively cancel everything scheduled for a given sessionKey.
 * Use this when re-scheduling to prevent ghost notifications from
 * prior rows that may have lost their stored ID.
 */
export async function cancelAllForSession(
  sessionKey: string,
  storedIds?: string | null,
): Promise<void> {
  await managerCancelForSession(sessionKey, storedIds);
}

/**
 * Pool of upcoming session messages (Type B) — motivate before the session.
 */
export const UPCOMING_SESSION_MESSAGES = [
  "Hey {{name}}, your session is coming up soon. Let's crush it!",
  "{{name}}, time to get ready! Your session starts soon.",
  "Heads up {{name}} — your workout is almost here. You've got this!",
  "{{name}}, your session is around the corner. Lace up!",
  "Almost time, {{name}}! Get ready to show up for yourself.",
  "{{name}}, your body is ready. Your session starts soon — let's go!",
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
