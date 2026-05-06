import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Switch,
  StyleSheet,
  Linking,
  Modal,
  Pressable,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { LinearGradient } from 'expo-linear-gradient';
import { useCoachSetupStore } from '../../store/coachSetupStore';
import { useRunProgressStore } from '../../store/runProgressStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useNotificationPrefsStore } from '../../store/notificationPrefsStore';
import { registerForPushNotifications } from '../../services/notificationService';
import { getDiscoverable, setDiscoverable } from '../../services/communityService';
import { SettingsSection } from './components/SettingsSection';
import { SettingsRow } from './components/SettingsRow';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { colors, fonts, spacing } from '../../theme';
import { APP_CONFIG } from '../../config/appConfig';
import type { RunStackParamList } from '../../navigation/RunNavigator';

type NavProp = NativeStackNavigationProp<RunStackParamList>;

export default function SettingsScreen() {
  const navigation = useNavigation<NavProp>();
  const isGuest = useAuthStore((s) => s.isGuest);
  const exitGuestMode = useAuthStore((s) => s.exitGuestMode);

  const setupData = useCoachSetupStore((s) => s.setupData);
  const resetSetup = useCoachSetupStore((s) => s.resetSetup);
  const resetProgress = useRunProgressStore((s) => s.resetProgress);

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

  // Hydrate prefs on mount so the toggles reflect server-side truth
  useEffect(() => {
    hydratePrefs();
    getDiscoverable().then(setDiscoverableLocal);
  }, [hydratePrefs]);

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

  const promptQuietHours = () => setQuietHoursVisible(true);

  const handleQuietHoursSelect = (start: number, end: number) => {
    setQuietHours(start, end);
    setQuietHoursVisible(false);
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
    resetSetup();
    resetProgress();
    resetSettings();
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
    } catch (e) {
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
    } catch (e) {
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
          <Pressable
            style={styles.guestBanner}
            onPress={exitGuestMode}
          >
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

        {/* Profile */}
        <SettingsSection title="PROFILE">
          <SettingsRow
            label="Name"
            value={setupData.userName || 'Not set'}
            onPress={() => navigation.navigate('EditName')}
            showChevron
          />
          <SettingsRow
            label="Started"
            value={formatStartDate()}
          />
        </SettingsSection>

        {/* Privacy */}
        <SettingsSection title="PRIVACY">
          <SettingsRow
            label="Show me in Bench March"
            value={discoverable ? 'On' : 'Off'}
            rightElement={
              <Switch
                value={discoverable}
                onValueChange={handleDiscoverableToggle}
                trackColor={{ false: colors.dotInactive, true: colors.primaryBright }}
                thumbColor={discoverable ? colors.primary : colors.textTertiary}
              />
            }
          />
          <Text style={styles.privacyHelp}>
            When off, your profile and stats are hidden from other runners.
          </Text>
        </SettingsSection>

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
              <Switch
                value={notificationPermission === 'granted'}
                onValueChange={handleNotificationToggle}
                trackColor={{ false: colors.dotInactive, true: colors.primaryBright }}
                thumbColor={notificationPermission === 'granted' ? colors.primary : colors.textTertiary}
              />
            }
          />
          <SettingsRow
            label="Voice Cues"
            rightElement={
              <Switch
                value={voiceCuesEnabled}
                onValueChange={setVoiceCuesEnabled}
                trackColor={{ false: colors.dotInactive, true: colors.primaryBright }}
                thumbColor={voiceCuesEnabled ? colors.primary : colors.textTertiary}
              />
            }
          />
          <SettingsRow
            label="Haptic Feedback"
            rightElement={
              <Switch
                value={hapticFeedbackEnabled}
                onValueChange={setHapticFeedbackEnabled}
                trackColor={{ false: colors.dotInactive, true: colors.primaryBright }}
                thumbColor={hapticFeedbackEnabled ? colors.primary : colors.textTertiary}
              />
            }
          />
        </SettingsSection>

        {/* Notification Preferences (granular) */}
        <SettingsSection title="NOTIFICATION PREFERENCES">
          <SettingsRow
            label="Session Reminders"
            value={prefs.session_reminders ? 'On' : 'Off'}
            rightElement={
              <Switch
                value={prefs.session_reminders}
                onValueChange={(v) => setPref('session_reminders', v)}
                trackColor={{ false: colors.dotInactive, true: colors.primaryBright }}
                thumbColor={prefs.session_reminders ? colors.primary : colors.textTertiary}
                disabled={!quietHoursGranted}
              />
            }
          />
          <SettingsRow
            label="Motivational Check-ins"
            value={prefs.reengagement ? 'On' : 'Off'}
            rightElement={
              <Switch
                value={prefs.reengagement}
                onValueChange={(v) => setPref('reengagement', v)}
                trackColor={{ false: colors.dotInactive, true: colors.primaryBright }}
                thumbColor={prefs.reengagement ? colors.primary : colors.textTertiary}
                disabled={!quietHoursGranted}
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
          <SettingsRow
            label="Version"
            value={APP_CONFIG.VERSION}
          />
          <SettingsRow
            label="Privacy Policy"
            onPress={() => openLink('https://marchbuddy.com/privacy')}
            showChevron
          />
          <SettingsRow
            label="Terms of Service"
            onPress={() => openLink('https://marchbuddy.com/terms')}
            showChevron
          />
          <SettingsRow
            label="Contact Support"
            onPress={() => openLink('mailto:support@marchbuddy.com')}
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
              Notifications won't be sent during these hours.{'\n'}
              Current: {formatHour(prefs.quiet_hours_start)} — {formatHour(prefs.quiet_hours_end)}
            </Text>

            <Pressable
              style={({ pressed }) => [styles.qhOption, pressed && { opacity: 0.85 }]}
              onPress={() => handleQuietHoursSelect(22, 7)}
            >
              <Text style={styles.qhOptionText}>Late evening (10 PM – 7 AM)</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.qhOption, pressed && { opacity: 0.85 }]}
              onPress={() => handleQuietHoursSelect(21, 6)}
            >
              <Text style={styles.qhOptionText}>Early night (9 PM – 6 AM)</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.qhOption, styles.qhOptionDanger, pressed && { opacity: 0.85 }]}
              onPress={() => handleQuietHoursSelect(0, 0)}
            >
              <Text style={[styles.qhOptionText, styles.qhOptionTextDanger]}>Always on (disable)</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.qhCancel, pressed && { opacity: 0.85 }]}
              onPress={() => setQuietHoursVisible(false)}
            >
              <Text style={styles.qhCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  qhOption: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  qhOptionDanger: {
    borderColor: 'rgba(244,63,94,0.3)',
  },
  qhOptionText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  qhOptionTextDanger: {
    color: colors.danger,
  },
  qhCancel: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: colors.primary,
    marginTop: 4,
  },
  qhCancelText: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: '#fff',
  },
});
