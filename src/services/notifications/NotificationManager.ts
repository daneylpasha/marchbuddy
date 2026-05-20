/**
 * NotificationManager — single source of truth for all on-device
 * notification scheduling and cancellation.
 *
 * Why this exists:
 *   Before this module, scheduling/cancellation was scattered across
 *   notificationService.ts, ScheduleSheet.tsx, and an Edge Function.
 *   That made it possible for:
 *     - the same session to schedule multiple overlapping reminders
 *       (see Phase-1 audit, bug #1)
 *     - ghost notifications to linger when local_notification_id was
 *       missing from the stored row (bug #6)
 *     - local notifications to bypass the server-side rate limit
 *       (bug #5)
 *
 * Responsibilities:
 *   1. `scheduleForSession` — respects user prefs, defensively clears
 *      any prior local notification for the same session_key, then
 *      schedules Type-A local reminders. Always stamps `sessionKey`
 *      onto the notification data payload so the listener can deep
 *      link.
 *   2. `cancelForSession` — belt-and-suspenders: cancels by stored ID
 *      *and* scans all currently-scheduled notifications, cancelling
 *      any whose data.sessionKey matches.
 *   3. `cancelByIds` — cancel a comma-separated ID string (legacy
 *      format kept for compatibility with existing stored rows).
 *   4. `logLocalReceived` — write a row into `notification_log` with
 *      source='local' so the server's 24h rate-limit accounts for
 *      what the user actually sees, not just server push.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useNotificationStore } from '../../store/notificationStore';
import { useNotificationPrefsStore } from '../../store/notificationPrefsStore';
import { supabase } from '../../api/supabase';

// ─── Quiet-hours gate ─────────────────────────────────────────────────────

// Mirrors the server-side check in send-push-notification: returns true
// when the given fire-time hour (0–23, user-local) falls inside the
// quiet window. Supports wrap-around windows (e.g. 22 → 7 = 22:00–06:59).
// start === end is treated as "disabled" so users can opt out by setting
// both to the same value.
function isInQuietWindow(hour: number, start: number, end: number): boolean {
  if (start === end) return false;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

// ─── Channels (Android) ───────────────────────────────────────────────────

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

// ─── Types ────────────────────────────────────────────────────────────────

export type NotificationKind = 'A' | 'B' | 'C';

export interface ScheduleInput {
  sessionKey: string;
  sessionTitle: string;
  scheduledAt: Date;
  userName: string;
}

// ─── Cancel ──────────────────────────────────────────────────────────────

/**
 * Cancel by comma-separated ID string (legacy format stored on
 * scheduled_sessions.local_notification_id).
 */
export async function cancelByIds(notificationIds: string | null | undefined): Promise<void> {
  if (!notificationIds) return;
  const ids = notificationIds
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  await Promise.all(
    ids.map((id) =>
      Notifications.cancelScheduledNotificationAsync(id).catch((err) => {
        // OS may have already cleared it — not fatal
        console.warn('cancelScheduledNotificationAsync failed:', err);
      }),
    ),
  );
}

/**
 * Belt-and-suspenders cancellation: in addition to any stored IDs,
 * scans all currently-scheduled notifications on the device and
 * cancels any whose `data.sessionKey` matches. Fixes the race where
 * a prior schedule was persisted without an ID.
 */
export async function cancelForSession(
  sessionKey: string,
  storedIds?: string | null,
): Promise<void> {
  if (storedIds) {
    await cancelByIds(storedIds);
  }

  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    const matching = all.filter(
      (n) => (n.content?.data as { sessionKey?: string } | undefined)?.sessionKey === sessionKey,
    );
    await Promise.all(
      matching.map((n) =>
        Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {}),
      ),
    );
  } catch (err) {
    // getAllScheduledNotificationsAsync can fail on some dev emulators — not fatal
    console.warn('cancelForSession sweep failed:', err);
  }
}

// ─── Schedule ────────────────────────────────────────────────────────────

/**
 * Schedule the pair of Type-A local reminders for a session. Returns
 * comma-separated notification IDs (same storage format as before so
 * existing DB rows continue to work) or null if nothing was scheduled.
 *
 * Pre-conditions enforced:
 *   - OS permission granted
 *   - User has `session_reminders` pref enabled
 *   - No prior schedule exists for this sessionKey (swept first)
 */
export async function scheduleForSession({
  sessionKey,
  sessionTitle,
  scheduledAt,
  userName,
}: ScheduleInput): Promise<string | null> {
  // Respect user preference — if they've disabled session reminders,
  // do nothing. This mirrors the server-side check for re-engagement.
  const prefs = useNotificationPrefsStore.getState().prefs;
  if (!prefs.session_reminders) return null;

  const { permissionStatus } = useNotificationStore.getState();
  if (permissionStatus !== 'granted') return null;

  await ensureChannels();

  // Sweep any lingering prior schedules for this session first. This
  // makes re-scheduling idempotent even if the previous stored ID was
  // lost.
  await cancelForSession(sessionKey);

  const now = new Date();
  const ids: string[] = [];
  const channelId = Platform.OS === 'android' ? 'session-reminders' : undefined;
  const quietStart = prefs.quiet_hours_start;
  const quietEnd = prefs.quiet_hours_end;

  const commonData = {
    type: 'A' as const,
    sessionKey,
    sessionTitle,
  };

  // 1. At the exact scheduled time — skip if fire-time falls in the
  //    user's quiet window. Local notifications cannot consult JS at
  //    fire time (OS dispatches them), so we have to gate at schedule
  //    time using the device's local hour.
  if (scheduledAt > now && !isInQuietWindow(scheduledAt.getHours(), quietStart, quietEnd)) {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: `Time for ${sessionTitle}!`,
          body: `${userName}, your session is starting now. Let's go!`,
          data: commonData,
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
    } catch (err) {
      console.error('scheduleForSession: failed to schedule primary:', err);
    }
  }

  // 2. 30-min-before reminder (only when meaningfully in the future and
  //    its fire-time is outside quiet hours).
  const earlyDate = new Date(scheduledAt.getTime() - 30 * 60 * 1000);
  if (earlyDate > now && !isInQuietWindow(earlyDate.getHours(), quietStart, quietEnd)) {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Session Reminder',
          body: `Hey ${userName}! Your ${sessionTitle} starts in 30 minutes. Lace up!`,
          data: commonData,
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
    } catch (err) {
      console.error('scheduleForSession: failed to schedule early:', err);
    }
  }

  return ids.length > 0 ? ids.join(',') : null;
}

// ─── Unified logging ──────────────────────────────────────────────────────

/**
 * Record that a local notification actually fired on-device. This
 * flows into `notification_log` with source='local' so that the
 * server's daily cap query (see send-push-notification Edge Function)
 * sees the full picture — local + push — not just push.
 *
 * Best-effort: never throws. Offline, guest, or unauthenticated users
 * simply don't log.
 */
export async function logLocalReceived(args: {
  type: NotificationKind;
  message: string;
  campaignId?: string | null;
}): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (!user) return;

    await supabase.from('notification_log').insert({
      user_id: user.id,
      type: args.type,
      message: args.message,
      campaign_id: args.campaignId ?? null,
      source: 'local',
    });
  } catch (err) {
    // Non-critical — we don't want a failed log to impact UX
    console.warn('logLocalReceived failed:', err);
  }
}
