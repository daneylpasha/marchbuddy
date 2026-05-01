import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Switch,
  StyleSheet,
  Alert,
  Linking,
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
import { SettingsSection } from './components/SettingsSection';
import { SettingsRow } from './components/SettingsRow';
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

  // Hydrate prefs on mount so the toggles reflect server-side truth
  useEffect(() => {
    hydratePrefs();
  }, [hydratePrefs]);

  const quietHoursGranted = notificationPermission === 'granted';

  const formatHour = (h: number): string => {
    const hh = ((h % 24) + 24) % 24;
    const ampm = hh >= 12 ? 'PM' : 'AM';
    const display = hh % 12 || 12;
    return `${display} ${ampm}`;
  };

  const promptQuietHours = () => {
    Alert.alert(
      'Quiet Hours',
      `Notifications won't be sent during quiet hours, evaluated in your local time.\n\nCurrent: ${formatHour(prefs.quiet_hours_start)} — ${formatHour(prefs.quiet_hours_end)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Late evening (10 PM – 7 AM)',
          onPress: () => setQuietHours(22, 7),
        },
        {
          text: 'Early night (9 PM – 6 AM)',
          onPress: () => setQuietHours(21, 6),
        },
        {
          text: 'Always on (disable)',
          onPress: () => setQuietHours(0, 0),
          style: 'destructive',
        },
      ],
    );
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
      Alert.alert(
        'Disable Notifications',
        'To turn off notifications, go to your device Settings > Apps > March Buddy > Notifications.',
        [{ text: 'OK' }],
      );
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
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open link'));
  };

  const handleResetOnboarding = () => {
    Alert.alert(
      'Reset Onboarding?',
      'This will take you back to the welcome screen. Your progress will be kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => resetSetup(),
        },
      ],
    );
  };

  const handleClearAllData = () => {
    Alert.alert(
      'Clear All Data?',
      'This will delete all your progress, sessions, and settings. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: () => {
            resetSetup();
            resetProgress();
            resetSettings();
          },
        },
      ],
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account?',
      'This will permanently delete your account and all associated data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: () => {
            // Double confirmation for safety
            Alert.alert(
              'Are you absolutely sure?',
              'All your progress, sessions, and personal data will be permanently removed.',
              [
                { text: 'Go Back', style: 'cancel' },
                {
                  text: 'Yes, Delete Everything',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await useAuthStore.getState().deleteAccount();
                    } catch (e) {
                      Alert.alert('Error', 'Could not delete account. Please try again or contact support.');
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out?',
      'You will need to sign in again. All local data will be cleared.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await useAuthStore.getState().signOut();
            } catch (e) {
              Alert.alert('Error', 'Could not sign out. Try again.');
            }
          },
        },
      ],
    );
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
});
