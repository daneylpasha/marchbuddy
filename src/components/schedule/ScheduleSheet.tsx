import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { useScheduleStore, type ScheduledSession } from '../../store/scheduleStore';
import { useCoachSetupStore } from '../../store/coachSetupStore';
import {
  scheduleSessionReminder,
  cancelScheduledNotification,
} from '../../services/notificationService';
import { colors, fonts, spacing } from '../../theme';

export interface ScheduleSheetRef {
  present: (sessionKey: string, sessionTitle: string, existing?: ScheduledSession) => void;
}

interface Props {
  onScheduled?: (scheduledAt: Date) => void;
}

function getNext7Days(): Date[] {
  const days: Date[] = [];
  const now = new Date();
  for (let i = 1; i <= 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    d.setHours(0, 0, 0, 0);
    days.push(d);
  }
  return days;
}

function formatDayLabel(date: Date): string {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${dayNames[date.getDay()]} ${date.getDate()}`;
}

function formatConfirmation(date: Date): string {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 || 12;
  const displayMin = minutes.toString().padStart(2, '0');
  return `${dayNames[date.getDay()]} ${date.getDate()} at ${displayHour}:${displayMin} ${ampm}`;
}

const ScheduleSheet = forwardRef<ScheduleSheetRef, Props>(({ onScheduled }, ref) => {
  const modalRef = useRef<BottomSheetModal>(null);
  const [sessionKey, setSessionKey] = useState('');
  const [sessionTitle, setSessionTitle] = useState('');
  const [existingSchedule, setExistingSchedule] = useState<ScheduledSession | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(getNext7Days()[0]);
  const [selectedTime, setSelectedTime] = useState<Date>(() => {
    const d = new Date();
    d.setHours(7, 0, 0, 0);
    return d;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const { scheduleSession, updateSchedule, cancelSchedule, setLocalNotificationId } =
    useScheduleStore();
  const userName = useCoachSetupStore((s) => s.setupData.userName);
  const days = useMemo(() => getNext7Days(), []);
  const snapPoints = useMemo(() => ['52%'], []);

  useImperativeHandle(ref, () => ({
    present: (key, title, existing) => {
      setSessionKey(key);
      setSessionTitle(title);
      setExistingSchedule(existing ?? null);
      setConfirmation(null);
      setIsSubmitting(false);

      if (existing) {
        const existingDate = new Date(existing.scheduled_at);
        // Find closest day chip
        const closest = days.find(
          (d) => d.toDateString() === existingDate.toDateString(),
        );
        if (closest) setSelectedDate(closest);
        setSelectedTime(existingDate);
      } else {
        setSelectedDate(days[0]);
        const defaultTime = new Date();
        defaultTime.setHours(7, 0, 0, 0);
        setSelectedTime(defaultTime);
      }

      modalRef.current?.present();
    },
  }));

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const scheduledAt = new Date(selectedDate);
      scheduledAt.setHours(
        selectedTime.getHours(),
        selectedTime.getMinutes(),
        0,
        0,
      );

      if (existingSchedule) {
        // Cancel old local notification if it exists
        if (existingSchedule.local_notification_id) {
          await cancelScheduledNotification(existingSchedule.local_notification_id);
        }
        await updateSchedule(
          existingSchedule.id,
          sessionKey,
          sessionTitle,
          scheduledAt,
        );
        // Schedule new local notification
        const notifId = await scheduleSessionReminder(
          sessionTitle,
          scheduledAt,
          userName || 'there',
        );
        if (notifId) {
          setLocalNotificationId(existingSchedule.id, notifId);
        }
      } else {
        const row = await scheduleSession(sessionKey, sessionTitle, scheduledAt);
        // Schedule local notification (Type A)
        const notifId = await scheduleSessionReminder(
          sessionTitle,
          scheduledAt,
          userName || 'there',
        );
        if (notifId) {
          setLocalNotificationId(row.id, notifId);
        }
      }

      setConfirmation(formatConfirmation(scheduledAt));
      onScheduled?.(scheduledAt);

      // Auto-dismiss after showing confirmation
      setTimeout(() => modalRef.current?.dismiss(), 2000);
    } catch (e) {
      console.error('Schedule failed:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (existingSchedule) {
      setIsSubmitting(true);
      try {
        // Cancel the local notification
        if (existingSchedule.local_notification_id) {
          await cancelScheduledNotification(existingSchedule.local_notification_id);
        }
        await cancelSchedule(existingSchedule.id);
        modalRef.current?.dismiss();
      } catch (e) {
        console.error('Cancel schedule failed:', e);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      modalRef.current?.dismiss();
    }
  };

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.6}
        pressBehavior="close"
      />
    ),
    [],
  );

  const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

  return (
    <BottomSheetModal
      ref={modalRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
    >
      <BottomSheetView style={styles.content}>
        {confirmation ? (
          <View style={styles.confirmationContainer}>
            <Ionicons name="checkmark-circle" size={48} color={colors.primary} />
            <Text style={styles.confirmationText}>
              Reminder set for {confirmation}
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.title}>Schedule this session</Text>
            <Text style={styles.sessionName}>{sessionTitle}</Text>

            {/* Date chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dateRow}
            >
              {days.map((day) => {
                const isSelected = isSameDay(day, selectedDate);
                return (
                  <Pressable
                    key={day.toISOString()}
                    style={[
                      styles.dateChip,
                      isSelected && styles.dateChipSelected,
                    ]}
                    onPress={() => setSelectedDate(day)}
                  >
                    <Text
                      style={[
                        styles.dateChipText,
                        isSelected && styles.dateChipTextSelected,
                      ]}
                    >
                      {formatDayLabel(day)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Time picker */}
            <View style={styles.timeSection}>
              <Text style={styles.timeLabel}>Time</Text>
              <DateTimePicker
                value={selectedTime}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, date) => {
                  if (date) setSelectedTime(date);
                }}
                themeVariant="dark"
                minuteInterval={5}
                style={styles.timePicker}
              />
            </View>

            {/* Submit button */}
            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                pressed && styles.submitButtonPressed,
                isSubmitting && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {existingSchedule ? 'Update Reminder' : 'Set Reminder'}
                </Text>
              )}
            </Pressable>

            {/* Cancel link */}
            <Pressable style={styles.cancelLink} onPress={handleCancel}>
              <Text style={styles.cancelLinkText}>
                {existingSchedule ? 'Remove Reminder' : 'Cancel'}
              </Text>
            </Pressable>
          </>
        )}
      </BottomSheetView>
    </BottomSheetModal>
  );
});

ScheduleSheet.displayName = 'ScheduleSheet';

export default ScheduleSheet;

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handleIndicator: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: 40,
  },
  content: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 8,
    paddingBottom: 32,
  },
  title: {
    fontFamily: fonts.semiBold,
    fontSize: 20,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  sessionName: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  dateRow: {
    gap: 8,
    paddingBottom: 20,
  },
  dateChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  dateChipSelected: {
    backgroundColor: colors.primaryDim,
    borderColor: colors.primary,
  },
  dateChipText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textSecondary,
  },
  dateChipTextSelected: {
    color: colors.primary,
  },
  timeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  timeLabel: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textSecondary,
    marginRight: 12,
  },
  timePicker: {
    flex: 1,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  submitButtonPressed: {
    opacity: 0.85,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: '#fff',
    letterSpacing: 0.3,
  },
  cancelLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelLinkText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textTertiary,
  },
  confirmationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 16,
  },
  confirmationText: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.textPrimary,
    textAlign: 'center',
  },
});
