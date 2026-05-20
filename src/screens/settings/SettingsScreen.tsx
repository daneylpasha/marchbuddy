import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Linking,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { LinearGradient } from 'expo-linear-gradient';
import { useCoachSetupStore } from '../../store/coachSetupStore';
import { useRunProgressStore } from '../../store/runProgressStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useNotificationPrefsStore } from '../../store/notificationPrefsStore';
import { registerForPushNotifications } from '../../services/notificationService';
import { getDiscoverable, setDiscoverable } from '../../services/communityService';
import { featureFlags } from '../../constants/featureFlags';
import { SettingsSection } from './components/SettingsSection';
import { SettingsRow } from './components/SettingsRow';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import ContactSupportSheet, {
  type ContactSupportSheetRef,
} from '../../components/settings/ContactSupportSheet';
import { AppSwitch } from '../../components/common/AppSwitch';
import { colors, fonts, spacing } from '../../theme';
import { APP_CONFIG } from '../../config/appConfig';
import type { RunStackParamList } from '../../navigation/RunNavigator';

type NavProp = NativeStackNavigationProp<RunStackParamList>;

export default function SettingsScreen() {
  const navigation = useNavigation<NavProp>();
  const supportSheetRef = useRef<ContactSupportSheetRef>(null);
  const isGuest = useAuthStore((s) => s.isGuest);
  const exitGuestMode = useAuthStore((s) => s.exitGuestMode);
  const userEmail = useAuthStore((s) => s.user?.email);
  const showCommunity = featureFlags.community(userEmail);

  const setupData = useCoachSetupStore((s) => s.setupData);
  const resetSetup = useCoachSetupStore((s) => s.resetSetup);
  const resetProgress = useRunProgressStore((s) => s.resetProgress);

  const tier = useSubscriptionStore((s) => s.tier);
  const openPaywall = useSubscriptionStore((s) => s.openPaywall);
  const isPro = tier === 'pro';

  const {
    distanceUnit,
    hapticFeedbackEnabled,
    voiceCuesEnabled,
    setDistanceUnit,
    setHapticFeedbackEnabled,
    setVoiceCuesEnabled,
    resetSettings,
  } = useSettingsStore();

  const notificationPermission = useNotificationStore((s) => s.permissionStatus);
  const setPermissionStatus = useNotificationStore((s) => s.setPermissionStatus);

  const prefs = useNotificationPrefsStore((s) => s.prefs);
  const setPref = useNotificationPrefsStore((s) => s.setPref);
  const setQuietHours = useNotificationPrefsStore((s) => s.setQuietHours);
  const hydratePrefs = useNotificationPrefsStore((s) => s.hydrateFromServer);

  const [discoverable, setDiscoverableLocal] = useState(true);
  const [signOutConfirmVisible, setSignOutConfirmVisible] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [resetOnboardingVisible, setResetOnboardingVisible] = useState(false);
  const [clearDataVisible, setClearDataVisible] = useState(false);
  const [deleteAccountVisible, setDeleteAccountVisible] = useState(false);
  const [deleteAccountFinalVisible, setDeleteAccountFinalVisible] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null);
  const [quietHoursVisible, setQuietHoursVisible] = useState(false);
  const [tempStartHour, setTempStartHour] = useState(22);
  const [tempEndHour, setTempEndHour] = useState(7);
  const [showStartPickerIOS, setShowStartPickerIOS] = useState(false);
  const [showEndPickerIOS, setShowEndPickerIOS] = useState(false);

  // Hydrate prefs on mount so the toggles reflect server-side truth
  useEffect(() => {
    hydratePrefs();
    if (showCommunity) {
      getDiscoverable().then(setDiscoverableLocal);
    }
  }, [hydratePrefs, showCommunity]);

  const handleDiscoverableToggle = (value: boolean) => {
    setDiscoverableLocal(value);
    setDiscoverable(value).catch(() => setDiscoverableLocal(!value));
  };

  const quietHoursGranted = notificationPermission === 'granted';

  const formatHour = (h: number): string => {
    const hh = ((h % 24) + 24) % 24;
    const ampm = hh >= 12 ? 'PM' : 'AM';
    const display = hh % 12 || 12;
    return `${display} ${ampm}`;
  };

  const promptQuietHours = () => {
    // Seed picker state from current prefs every time the modal opens so
    // editing reflects the actual saved values, not a stale draft.
    setTempStartHour(prefs.quiet_hours_start);
    setTempEndHour(prefs.quiet_hours_end);
    setShowStartPickerIOS(false);
    setShowEndPickerIOS(false);
    setQuietHoursVisible(true);
  };

  const handleQuietHoursSelect = (start: number, end: number) => {
    setQuietHours(start, end);
    setQuietHoursVisible(false);
  };

  const hourToDate = (h: number): Date => {
    const d = new Date();
    d.setHours(h, 0, 0, 0);
    return d;
  };

  const openTimePicker = (which: 'start' | 'end') => {
    const initial = which === 'start' ? tempStartHour : tempEndHour;
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: hourToDate(initial),
        mode: 'time',
        is24Hour: false,
        onChange: (event: DateTimePickerEvent, date?: Date) => {
          if (event.type === 'set' && date) {
            if (which === 'start') setTempStartHour(date.getHours());
            else setTempEndHour(date.getHours());
          }
        },
      });
    } else {
      // iOS: toggle inline spinner below the row
      if (which === 'start') {
        setShowStartPickerIOS((v) => !v);
        setShowEndPickerIOS(false);
      } else {
        setShowEndPickerIOS((v) => !v);
        setShowStartPickerIOS(false);
      }
    }
  };

  const handleSaveQuietHours = () => {
    handleQuietHoursSelect(tempStartHour, tempEndHour);
  };

  const handleDisableQuietHours = () => {
    handleQuietHoursSelect(0, 0);
  };

  // Sync store with actual OS permission on mount
  useEffect(() => {
    (async () => {
      const { status } = await Notifications.getPermissionsAsync();
      setPermissionStatus(status === 'granted' ? 'granted' : 'denied');
    })();
  }, [setPermissionStatus]);

  const handleNotificationToggle = async (value: boolean) => {
    if (value) {
      await registerForPushNotifications();
    } else {
      setErrorDialog({
        title: 'Disable Notifications',
        message:
          'To turn off notifications, go to your device Settings > Apps > March Buddy > Notifications.',
      });
    }
  };

  const formatStartDate = () => {
    if (!setupData.completedAt) return 'Recently';
    return new Date(setupData.completedAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() =>
      setErrorDialog({ title: 'Error', message: 'Could not open link.' }),
    );
  };

  const handleResetOnboarding = () => setResetOnboardingVisible(true);
  const handleClearAllData = () => setClearDataVisible(true);
  const handleDeleteAccount = () => setDeleteAccountVisible(true);
  const handleSignOut = () => setSignOutConfirmVisible(true);

  const confirmResetOnboarding = () => {
    resetSetup();
    setResetOnboardingVisible(false);
  };

  const confirmClearData = () => {
    // Reset every store that holds user-specific state. Previously only
    // resetSetup / resetProgress / resetSettings were called, which left
    // stale data in several places — most visibly the cached
    // sessionStore.todayOptions, so TodayScreen kept rendering the old
    // level's session plan until the user pulled-to-refresh (loadOptions
    // bails early when todayOptions is already populated, see
    // TodayScreen loadOptions: `if (!force && todayOptions) return;`).
    // subscriptionStore (startingLevel / freeUntilLevel / tier) was also
    // stale, which can fork future paywall behavior.
    //
    // Lazy require pattern matches authStore.signOut so this stays
    // independent of import order and avoids pulling every store into
    // SettingsScreen's bundle.
    resetSetup();
    resetProgress();
    resetSettings();
    const { useSessionStore } = require('../../store/sessionStore');
    useSessionStore.getState().clearTodayOptions();
    useSubscriptionStore.getState().reset();
    const { useActiveSessionStore } = require('../../store/activeSessionStore');
    useActiveSessionStore.getState().resetSession();
    const { useChatStore } = require('../../store/chatStore');
    useChatStore.setState({ messages: [], isAiTyping: false });
    const { useWorkoutStore } = require('../../store/workoutStore');
    useWorkoutStore.setState({
      todayWorkout: null,
      workoutHistory: [],
      historyLoading: false,
      summary: null,
      isLoading: false,
    });
    const { useNutritionStore } = require('../../store/nutritionStore');
    useNutritionStore.setState({ todayMealPlan: null, foodSnaps: [], isLoading: false });
    const { useWaterStore } = require('../../store/waterStore');
    useWaterStore.setState({ todayWaterLog: null });
    const { useScheduleStore } = require('../../store/scheduleStore');
    useScheduleStore.setState({ scheduledSessions: [] });
    const { useProgressStore } = require('../../store/progressStore');
    useProgressStore.getState().reset();
    setClearDataVisible(false);
  };

  const confirmDeleteAccountStep1 = () => {
    setDeleteAccountVisible(false);
    setDeleteAccountFinalVisible(true);
  };

  const confirmDeleteAccountFinal = async () => {
    if (deletingAccount) return;
    setDeletingAccount(true);
    try {
      await useAuthStore.getState().deleteAccount();
      setDeleteAccountFinalVisible(false);
    } catch {
      setDeleteAccountFinalVisible(false);
      setErrorDialog({
        title: 'Delete Failed',
        message: 'Could not delete account. Please try again or contact support.',
      });
    } finally {
      setDeletingAccount(false);
    }
  };

  const confirmSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await useAuthStore.getState().signOut();
      setSignOutConfirmVisible(false);
    } catch {
      setSignOutConfirmVisible(false);
      setErrorDialog({
        title: 'Sign Out Failed',
        message: 'Could not sign out. Please try again.',
      });
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Guest Banner */}
        {isGuest && (
          <Pressable style={styles.guestBanner} onPress={exitGuestMode}>
            <LinearGradient
              colors={['rgba(16,185,129,0.15)', 'rgba(16,185,129,0.05)']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={styles.guestBannerContent}>
              <Ionicons name="person-add-outline" size={22} color={colors.primary} />
              <View style={styles.guestBannerText}>
                <Text style={styles.guestBannerTitle}>You're in Guest Mode</Text>
                <Text style={styles.guestBannerSubtitle}>
                  Sign up to save your progress and unlock all features
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.primary} />
            </View>
          </Pressable>
        )}

        {/* MarchBuddy Pro — always-visible upgrade entry (or status for Pro users) */}
        <Pressable
          style={styles.proCard}
          onPress={() => openPaywall('settings_upgrade_row')}
          disabled={isPro}
        >
          <LinearGradient
            colors={
              isPro
                ? ['rgba(16,185,129,0.18)', 'rgba(16,185,129,0.05)']
                : ['rgba(16,185,129,0.22)', 'rgba(16,185,129,0.06)']
            }
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={styles.proCardContent}>
            <View style={styles.proIconRing}>
              <Ionicons
                name={isPro ? 'checkmark-circle' : 'flash'}
                size={20}
                color={colors.primary}
              />
            </View>
            <View style={styles.proTextBlock}>
              <View style={styles.proTitleRow}>
                <Text style={styles.proTitle}>MarchBuddy Pro</Text>
                <View style={isPro ? styles.proStatusBadge : styles.freeStatusBadge}>
                  <Text style={isPro ? styles.proStatusText : styles.freeStatusText}>
                    {isPro ? 'ACTIVE' : 'FREE PLAN'}
                  </Text>
                </View>
              </View>
              <Text style={styles.proSubtitle}>
                {isPro
                  ? 'All levels, unlimited coach, every feature unlocked.'
                  : 'Unlock all 16 levels, unlimited AI coach & more.'}
              </Text>
            </View>
            {!isPro && <Ionicons name="chevron-forward" size={18} color={colors.primary} />}
          </View>
        </Pressable>

        {/* Profile */}
        <SettingsSection title="PROFILE">
          <SettingsRow
            label="Name"
            value={setupData.userName || 'Not set'}
            onPress={() => navigation.navigate('EditName')}
            showChevron
          />
          <SettingsRow label="Started" value={formatStartDate()} />
        </SettingsSection>

        {/* Privacy — only relevant when Community is visible to this user */}
        {showCommunity && (
          <SettingsSection title="PRIVACY">
            <SettingsRow
              label="Show me in Bench March"
              rightElement={
                <AppSwitch
                  value={discoverable}
                  onValueChange={handleDiscoverableToggle}
                  accessibilityLabel="Show me in Bench March"
                />
              }
            />
            <Text style={styles.privacyHelp}>
              When off, your profile and stats are hidden from other runners.
            </Text>
          </SettingsSection>
        )}

        {/* Preferences */}
        <SettingsSection title="PREFERENCES">
          <SettingsRow
            label="Distance Unit"
            value={distanceUnit === 'km' ? 'Kilometers' : 'Miles'}
            onPress={() => setDistanceUnit(distanceUnit === 'km' ? 'miles' : 'km')}
            showChevron
          />
          <SettingsRow
            label="Notifications"
            rightElement={
              <AppSwitch
                value={notificationPermission === 'granted'}
                onValueChange={handleNotificationToggle}
                accessibilityLabel="Notifications"
              />
            }
          />
          <SettingsRow
            label="Voice Cues"
            rightElement={
              <AppSwitch
                value={voiceCuesEnabled}
                onValueChange={setVoiceCuesEnabled}
                accessibilityLabel="Voice Cues"
              />
            }
          />
          <SettingsRow
            label="Haptic Feedback"
            rightElement={
              <AppSwitch
                value={hapticFeedbackEnabled}
                onValueChange={setHapticFeedbackEnabled}
                accessibilityLabel="Haptic Feedback"
              />
            }
          />
        </SettingsSection>

        {/* Notification Preferences (granular) */}
        <SettingsSection title="NOTIFICATION PREFERENCES">
          <SettingsRow
            label="Session Reminders"
            rightElement={
              <AppSwitch
                value={prefs.session_reminders}
                onValueChange={(v) => setPref('session_reminders', v)}
                disabled={!quietHoursGranted}
                accessibilityLabel="Session Reminders"
              />
            }
          />
          <SettingsRow
            label="Motivational Check-ins"
            rightElement={
              <AppSwitch
                value={prefs.reengagement}
                onValueChange={(v) => setPref('reengagement', v)}
                disabled={!quietHoursGranted}
                accessibilityLabel="Motivational Check-ins"
              />
            }
          />
          <SettingsRow
            label="Quiet Hours"
            value={
              prefs.quiet_hours_start === prefs.quiet_hours_end
                ? 'Off'
                : `${formatHour(prefs.quiet_hours_start)} — ${formatHour(prefs.quiet_hours_end)}`
            }
            onPress={promptQuietHours}
            showChevron
          />
        </SettingsSection>

        {/* About */}
        <SettingsSection title="ABOUT">
          <SettingsRow label="Version" value={APP_CONFIG.VERSION} />
          <SettingsRow
            label="Privacy Policy"
            onPress={() => navigation.navigate('PrivacyPolicy')}
            showChevron
          />
          <SettingsRow
            label="Terms of Service"
            onPress={() => navigation.navigate('TermsOfService')}
            showChevron
          />
          <SettingsRow
            label="Contact Support"
            onPress={() => supportSheetRef.current?.present()}
            showChevron
          />
          <SettingsRow
            label="Send Feedback"
            onPress={() => navigation.navigate('Feedback')}
            showChevron
          />
        </SettingsSection>

        {/* Account */}
        <SettingsSection title="ACCOUNT">
          {isGuest ? (
            <SettingsRow
              label="Create Account"
              labelStyle={{ color: colors.primary, fontFamily: fonts.semiBold }}
              onPress={exitGuestMode}
              showChevron
            />
          ) : (
            <>
              <SettingsRow
                label="Sign Out"
                labelStyle={styles.dangerText}
                onPress={handleSignOut}
                showChevron
              />
              <SettingsRow
                label="Delete Account"
                labelStyle={styles.dangerText}
                onPress={handleDeleteAccount}
                showChevron
              />
            </>
          )}
        </SettingsSection>

        {/* Danger Zone */}
        <SettingsSection title="DANGER ZONE">
          <SettingsRow
            label="Reset Onboarding"
            labelStyle={styles.dangerText}
            onPress={handleResetOnboarding}
            showChevron
          />
          <SettingsRow
            label="Clear All Data"
            labelStyle={styles.dangerText}
            onPress={handleClearAllData}
            showChevron
          />
        </SettingsSection>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Made with care for runners everywhere</Text>
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={signOutConfirmVisible}
        icon="log-out-outline"
        title="Sign Out?"
        message="You'll need to sign in again. All local data will be cleared."
        confirmLabel={signingOut ? 'Signing out…' : 'Sign Out'}
        cancelLabel="Cancel"
        destructive
        onCancel={() => !signingOut && setSignOutConfirmVisible(false)}
        onConfirm={confirmSignOut}
      />

      <ConfirmDialog
        visible={resetOnboardingVisible}
        icon="refresh-outline"
        title="Reset Onboarding?"
        message="This will take you back to the welcome screen. Your progress will be kept."
        confirmLabel="Reset"
        cancelLabel="Cancel"
        destructive
        onCancel={() => setResetOnboardingVisible(false)}
        onConfirm={confirmResetOnboarding}
      />

      <ConfirmDialog
        visible={clearDataVisible}
        icon="trash-outline"
        title="Clear All Data?"
        message="This will delete all your progress, sessions, and settings. This cannot be undone."
        confirmLabel="Delete Everything"
        cancelLabel="Cancel"
        destructive
        onCancel={() => setClearDataVisible(false)}
        onConfirm={confirmClearData}
      />

      <ConfirmDialog
        visible={deleteAccountVisible}
        icon="warning-outline"
        title="Delete Account?"
        message="This will permanently delete your account and all associated data. This action cannot be undone."
        confirmLabel="Delete My Account"
        cancelLabel="Cancel"
        destructive
        onCancel={() => setDeleteAccountVisible(false)}
        onConfirm={confirmDeleteAccountStep1}
      />

      <ConfirmDialog
        visible={deleteAccountFinalVisible}
        icon="alert-circle-outline"
        title="Are you absolutely sure?"
        message="All your progress, sessions, and personal data will be permanently removed."
        confirmLabel={deletingAccount ? 'Deleting…' : 'Yes, Delete Everything'}
        cancelLabel="Go Back"
        destructive
        stackButtons
        onCancel={() => !deletingAccount && setDeleteAccountFinalVisible(false)}
        onConfirm={confirmDeleteAccountFinal}
      />

      {errorDialog && (
        <ConfirmDialog
          visible={!!errorDialog}
          icon="alert-circle-outline"
          title={errorDialog.title}
          message={errorDialog.message}
          confirmLabel="OK"
          cancelLabel="Close"
          onCancel={() => setErrorDialog(null)}
          onConfirm={() => setErrorDialog(null)}
        />
      )}

      <Modal
        visible={quietHoursVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setQuietHoursVisible(false)}
        statusBarTranslucent
      >
        <Pressable style={styles.qhBackdrop} onPress={() => setQuietHoursVisible(false)}>
          <Pressable style={styles.qhCard} onPress={() => {}}>
            <View style={styles.qhIconWrap}>
              <Ionicons name="moon-outline" size={26} color={colors.primary} />
            </View>
            <Text style={styles.qhTitle}>Quiet Hours</Text>
            <Text style={styles.qhMessage}>
              Notifications won't be sent during these hours.
            </Text>

            {/* Start time row */}
            <Pressable
              style={({ pressed }) => [
                styles.qhTimeRow,
                showStartPickerIOS && styles.qhTimeRowActive,
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => openTimePicker('start')}
            >
              <View style={styles.qhTimeLabelWrap}>
                <Ionicons name="moon-outline" size={18} color={colors.primary} />
                <Text style={styles.qhTimeLabel}>Start</Text>
              </View>
              <View style={styles.qhTimeValueWrap}>
                <Text style={styles.qhTimeValue}>{formatHour(tempStartHour)}</Text>
                <Ionicons name="chevron-down" size={16} color={colors.textTertiary} />
              </View>
            </Pressable>
            {showStartPickerIOS && Platform.OS === 'ios' && (
              <DateTimePicker
                value={hourToDate(tempStartHour)}
                mode="time"
                display="spinner"
                minuteInterval={30}
                themeVariant="dark"
                onChange={(_e, date) => {
                  if (date) setTempStartHour(date.getHours());
                }}
                style={styles.qhInlinePicker}
              />
            )}

            {/* End time row */}
            <Pressable
              style={({ pressed }) => [
                styles.qhTimeRow,
                showEndPickerIOS && styles.qhTimeRowActive,
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => openTimePicker('end')}
            >
              <View style={styles.qhTimeLabelWrap}>
                <Ionicons name="sunny-outline" size={18} color={colors.primary} />
                <Text style={styles.qhTimeLabel}>End</Text>
              </View>
              <View style={styles.qhTimeValueWrap}>
                <Text style={styles.qhTimeValue}>{formatHour(tempEndHour)}</Text>
                <Ionicons name="chevron-down" size={16} color={colors.textTertiary} />
              </View>
            </Pressable>
            {showEndPickerIOS && Platform.OS === 'ios' && (
              <DateTimePicker
                value={hourToDate(tempEndHour)}
                mode="time"
                display="spinner"
                minuteInterval={30}
                themeVariant="dark"
                onChange={(_e, date) => {
                  if (date) setTempEndHour(date.getHours());
                }}
                style={styles.qhInlinePicker}
              />
            )}

            {/* Save (primary) */}
            <Pressable
              style={({ pressed }) => [
                styles.qhPrimaryButton,
                tempStartHour === tempEndHour && styles.qhPrimaryButtonDisabled,
                pressed && { opacity: 0.85 },
              ]}
              onPress={handleSaveQuietHours}
              disabled={tempStartHour === tempEndHour}
            >
              <Text style={styles.qhPrimaryButtonText}>Save</Text>
            </Pressable>

            {/* Disable */}
            <Pressable
              style={({ pressed }) => [styles.qhGhostButton, pressed && { opacity: 0.85 }]}
              onPress={handleDisableQuietHours}
            >
              <Text style={styles.qhGhostButtonText}>Disable Quiet Hours</Text>
            </Pressable>

            {/* Cancel */}
            <Pressable
              style={({ pressed }) => [styles.qhCancelLink, pressed && { opacity: 0.6 }]}
              onPress={() => setQuietHoursVisible(false)}
            >
              <Text style={styles.qhCancelLinkText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <ContactSupportSheet ref={supportSheetRef} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textPrimary,
  },
  headerSpacer: {
    width: 36,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 24,
  },
  guestBanner: {
    marginHorizontal: spacing.lg,
    marginBottom: 16,
    borderRadius: spacing.cardRadius,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.25)',
    overflow: 'hidden',
  },
  proCard: {
    marginHorizontal: spacing.lg,
    marginBottom: 20,
    borderRadius: spacing.cardRadius,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.32)',
    overflow: 'hidden',
  },
  proCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  proIconRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(16,185,129,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  proTextBlock: {
    flex: 1,
    gap: 4,
  },
  proTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  proTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  proSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
    letterSpacing: 0.2,
  },
  freeStatusBadge: {
    backgroundColor: 'rgba(16,185,129,0.22)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  freeStatusText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    color: colors.primary,
    letterSpacing: 0.8,
  },
  proStatusBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  proStatusText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    color: '#fff',
    letterSpacing: 0.8,
  },
  guestBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  guestBannerText: {
    flex: 1,
    gap: 2,
  },
  guestBannerTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.textPrimary,
    letterSpacing: 0.2,
  },
  guestBannerSubtitle: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.textSecondary,
    letterSpacing: 0.2,
  },
  dangerText: {
    color: colors.danger,
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  footerText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textTertiary,
  },
  privacyHelp: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textTertiary,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    lineHeight: 16,
  },
  qhBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  qhCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.18)',
    gap: 10,
  },
  qhIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  qhTitle: {
    fontFamily: fonts.bold,
    fontSize: 19,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  qhMessage: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 12,
  },
  qhTimeRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  qhTimeRowActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDim,
  },
  qhTimeLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  qhTimeLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },
  qhTimeValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  qhTimeValue: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  qhInlinePicker: {
    width: '100%',
    height: 180,
    marginTop: -8,
    marginBottom: -8,
  },
  qhPrimaryButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: colors.primary,
    marginTop: 4,
  },
  qhPrimaryButtonDisabled: {
    opacity: 0.45,
  },
  qhPrimaryButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: '#fff',
    letterSpacing: 0.3,
  },
  qhGhostButton: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.35)',
  },
  qhGhostButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.danger,
    letterSpacing: 0.3,
  },
  qhCancelLink: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    marginTop: 2,
  },
  qhCancelLinkText: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
});
