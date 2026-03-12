import React from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { useCoachSetupStore } from '../../store/coachSetupStore';
import { useRunProgressStore } from '../../store/runProgressStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';
import { SettingsSection } from './components/SettingsSection';
import { SettingsRow } from './components/SettingsRow';
import { colors, fonts, spacing } from '../../theme';
import { APP_CONFIG } from '../../config/appConfig';
import type { RunStackParamList } from '../../navigation/RunNavigator';

type NavProp = NativeStackNavigationProp<RunStackParamList>;

export default function SettingsScreen() {
  const navigation = useNavigation<NavProp>();

  const setupData = useCoachSetupStore((s) => s.setupData);
  const resetSetup = useCoachSetupStore((s) => s.resetSetup);
  const resetProgress = useRunProgressStore((s) => s.resetProgress);

  const {
    distanceUnit,
    hapticFeedbackEnabled,
    setDistanceUnit,
    setHapticFeedbackEnabled,
    resetSettings,
  } = useSettingsStore();

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
            value="Coming Soon"
            rightElement={
              <View style={styles.comingSoonBadge}>
                <Text style={styles.comingSoonText}>COMING SOON</Text>
              </View>
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
            value="Bugs, ideas, or just say hi"
            onPress={() => navigation.navigate('Feedback')}
            showChevron
          />
        </SettingsSection>

        {/* Account */}
        <SettingsSection title="ACCOUNT">
          <SettingsRow
            label="Sign Out"
            labelStyle={styles.dangerText}
            onPress={handleSignOut}
            showChevron
          />
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
  comingSoonBadge: {
    backgroundColor: colors.primaryDim,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.25)',
  },
  comingSoonText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.primary,
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
