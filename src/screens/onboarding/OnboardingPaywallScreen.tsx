// OnboardingPaywallScreen — the final step of onboarding.
//
// Why a dedicated screen (vs. reusing PaywallModal):
//   This is the highest-converting moment in the app. The user just spent
//   5 minutes telling MarchBuddy their goals, hopes, and fears — intent is
//   at maximum. The framing here is "welcome to your full coach," not
//   "you've hit a wall." The visual treatment leans warm + premium, not
//   urgent + corrective like the contextual paywalls.
//
// Why skippable:
//   App Store guidelines require a free path through onboarding, and trust
//   matters more than top-line conversion at this stage. The "I'll start
//   free" link is small but present — users who want to evaluate the app
//   first can do so, and we re-surface the upgrade in many other places.

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useCoachSetupStore } from '../../store/coachSetupStore';
import { useAuthStore } from '../../store/authStore';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { analytics, EVENTS } from '../../services/analytics';
import { colors, fonts, spacing } from '../../theme';
import type { OnboardingStackParamList } from '../../navigation/AppNavigator';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'OnboardingPaywall'>;
type Plan = 'monthly' | 'annual';

const FEATURES = [
  { icon: 'trending-up' as const, text: 'All 16 levels — full running journey to 5K' },
  { icon: 'chatbubble' as const, text: 'Unlimited AI coach conversations' },
  { icon: 'checkmark-circle' as const, text: 'Personalized feedback after every session' },
  { icon: 'people' as const, text: 'Full community — challenges, teams & buddies' },
  { icon: 'trophy' as const, text: 'All 18 milestones + shareable achievement cards' },
];

export default function OnboardingPaywallScreen(_props: Props) {
  const setupData = useCoachSetupStore((s) => s.setupData);
  const markSetupComplete = useCoachSetupStore((s) => s.markSetupComplete);
  const upgrade = useSubscriptionStore((s) => s.upgrade);

  const [selectedPlan, setSelectedPlan] = useState<Plan>('annual');
  const openedAtRef = useRef<number>(Date.now());

  // Fire paywall_shown once on mount. Source is hardcoded since this screen
  // only exists for the onboarding entry point.
  useEffect(() => {
    analytics.track(EVENTS.paywall_shown, {
      source: 'onboarding',
      default_plan: selectedPlan,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Common path for both subscribe-success and skip — finalize the user
  // into the main app. Without this call, AppNavigator stays on the
  // OnboardingNavigator stack and the user is stuck on this screen.
  const finalizeOnboarding = async () => {
    markSetupComplete();
    // Persist onboarding to the server for real authenticated users.
    // Mirrors what handleReady in CoachSetupScreen used to do before we
    // moved the paywall step in between.
    const { user, isGuest, session } = useAuthStore.getState();
    if (session && user && !isGuest) {
      try {
        const { authService } = require('../../services/authService');
        await authService.syncLocalDataToSupabase(user.id);
      } catch (err) {
        console.warn('Failed to sync onboarding to server:', err);
      }
    }
  };

  const handleSelectPlan = (plan: Plan) => {
    if (plan === selectedPlan) return;
    setSelectedPlan(plan);
    analytics.track(EVENTS.paywall_plan_selected, { plan });
  };

  const handlePurchase = () => {
    analytics.track(EVENTS.paywall_cta_tapped, {
      plan: selectedPlan,
      source: 'onboarding',
    });

    // TODO: Replace with RevenueCat purchase flow (Fix #3)
    Alert.alert(
      'MarchBuddy Pro',
      `Subscribe to ${selectedPlan === 'annual' ? 'Annual Plan — $35/year' : 'Monthly Plan — $4.99/month'}?\n\nPayment integration coming soon.`,
      [
        {
          text: 'Not now',
          style: 'cancel',
          onPress: () => {
            analytics.track(EVENTS.purchase_cancelled, {
              plan: selectedPlan,
              source: 'onboarding',
            });
          },
        },
        {
          text: 'Subscribe',
          onPress: async () => {
            analytics.track(EVENTS.purchase_started, {
              plan: selectedPlan,
              source: 'onboarding',
            });
            upgrade();
            analytics.track(EVENTS.purchase_completed, {
              plan: selectedPlan,
              source: 'onboarding',
            });
            await finalizeOnboarding();
          },
        },
      ],
    );
  };

  const handleSkip = async () => {
    analytics.track(EVENTS.paywall_dismissed, {
      source: 'onboarding',
      time_visible_ms: Date.now() - openedAtRef.current,
      last_plan_selected: selectedPlan,
      method: 'skip_link',
    });
    await finalizeOnboarding();
  };

  const handleRestore = () => {
    analytics.track(EVENTS.paywall_restore_tapped, { source: 'onboarding' });
    Alert.alert('Restore Purchases', 'No previous purchases found.');
  };

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open link.'));
  };

  const firstName = setupData.userName || 'runner';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.iconRing}>
            <Ionicons name="flash" size={36} color={colors.primary} />
          </View>
          <Text style={styles.eyebrow}>YOUR PLAN IS READY</Text>
          <Text style={styles.headline}>You're set, {firstName}.</Text>
          <Text style={styles.tagline}>
            Unlock your full coach with MarchBuddy Pro — or start free and decide later.
          </Text>
        </View>

        {/* Plan cards */}
        <View style={styles.planRow}>
          <TouchableOpacity
            style={[styles.planCard, selectedPlan === 'annual' && styles.planCardSelected]}
            onPress={() => handleSelectPlan('annual')}
            activeOpacity={0.8}
          >
            {selectedPlan === 'annual' && (
              <View style={styles.saveBadge}>
                <Text style={styles.saveBadgeText}>SAVE 42%</Text>
              </View>
            )}
            <Text style={[styles.planLabel, selectedPlan === 'annual' && styles.planLabelSelected]}>
              Annual
            </Text>
            {/* Anchor price — $4.99 × 12 = $59.88 (honest comparison vs paying
                monthly for a year). */}
            <Text style={styles.planAnchor}>$59.88</Text>
            <Text style={styles.planPrice}>$35</Text>
            <Text style={styles.planPer}>per year</Text>
            <Text style={[styles.planSub, selectedPlan === 'annual' && styles.planSubSelected]}>
              ~$2.92 / month
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.planCard, selectedPlan === 'monthly' && styles.planCardSelected]}
            onPress={() => handleSelectPlan('monthly')}
            activeOpacity={0.8}
          >
            <Text
              style={[styles.planLabel, selectedPlan === 'monthly' && styles.planLabelSelected]}
            >
              Monthly
            </Text>
            <Text style={styles.planPrice}>$4.99</Text>
            <Text style={styles.planPer}>per month</Text>
            <Text style={[styles.planSub, selectedPlan === 'monthly' && styles.planSubSelected]}>
              cancel anytime
            </Text>
          </TouchableOpacity>
        </View>

        {/* Features */}
        <View style={styles.featureList}>
          {FEATURES.map((f) => (
            <View key={f.text} style={styles.featureRow}>
              <View style={styles.featureIconWrap}>
                <Ionicons name={f.icon} size={15} color={colors.primary} />
              </View>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.ctaButton} onPress={handlePurchase} activeOpacity={0.85}>
          <Ionicons name="flash" size={18} color="#fff" />
          <Text style={styles.ctaText}>
            {selectedPlan === 'annual'
              ? 'Start with Pro — $35 / year'
              : 'Start with Pro — $4.99 / month'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.renewalNote}>
          {Platform.OS === 'ios'
            ? 'Auto-renews until canceled. Manage in your App Store account settings.'
            : 'Auto-renews until canceled. Manage in Google Play subscriptions.'}
        </Text>

        <View style={styles.linkRow}>
          <TouchableOpacity
            onPress={() => openLink('https://marchbuddy.com/terms')}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            accessibilityRole="link"
            accessibilityLabel="Terms of Use"
          >
            <Text style={styles.linkText}>Terms of Use</Text>
          </TouchableOpacity>
          <Text style={styles.linkSeparator}>·</Text>
          <TouchableOpacity
            onPress={() => openLink('https://marchbuddy.com/privacy')}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            accessibilityRole="link"
            accessibilityLabel="Privacy Policy"
          >
            <Text style={styles.linkText}>Privacy Policy</Text>
          </TouchableOpacity>
          <Text style={styles.linkSeparator}>·</Text>
          <TouchableOpacity
            onPress={handleRestore}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            accessibilityRole="button"
            accessibilityLabel="Restore Purchases"
          >
            <Text style={styles.linkText}>Restore</Text>
          </TouchableOpacity>
        </View>

        {/* Skip — deliberately subtle but present. Required by Apple, and
            the right move for trust + retention. */}
        <TouchableOpacity
          onPress={handleSkip}
          style={styles.skipBtn}
          hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
        >
          <Text style={styles.skipText}>I'll start free ›</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 24,
    paddingBottom: 16,
    gap: 24,
  },
  hero: {
    alignItems: 'center',
    paddingTop: 8,
    gap: 8,
  },
  iconRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.primaryDim,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  eyebrow: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.primary,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  headline: {
    fontFamily: fonts.titleRegular,
    fontSize: 36,
    color: colors.textPrimary,
    letterSpacing: 0.5,
    textAlign: 'center',
    marginTop: 4,
  },
  tagline: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 21,
    letterSpacing: 0.2,
    textAlign: 'center',
    maxWidth: 320,
    marginTop: 4,
  },
  planRow: {
    flexDirection: 'row',
    gap: 12,
  },
  planCard: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 18,
    // Asymmetric vertical padding — extra top space for the floating
    // "SAVE 42%" badge above the Annual label.
    paddingTop: 22,
    paddingBottom: 18,
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    // Bumped to accommodate the strikethrough anchor row. Both cards
    // stretch to match the tallest card.
    minHeight: 160,
    justifyContent: 'center',
  },
  planCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDim,
  },
  saveBadge: {
    position: 'absolute',
    top: -10,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  saveBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    color: '#fff',
    letterSpacing: 1,
  },
  planLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.textTertiary,
    letterSpacing: 0.3,
  },
  planLabelSelected: {
    color: colors.primary,
  },
  // Strikethrough anchor — small + muted, sits between the plan label and
  // the discounted price. Honest comparison vs. paying monthly for a year.
  planAnchor: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
    letterSpacing: 0.2,
    textDecorationLine: 'line-through',
    textDecorationColor: colors.textMuted,
    marginBottom: 2,
  },
  planPrice: {
    fontFamily: fonts.bold,
    fontSize: 32,
    color: colors.textPrimary,
    letterSpacing: 0.3,
    lineHeight: 36,
  },
  planPer: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textTertiary,
    letterSpacing: 0.2,
  },
  planSub: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 0.2,
    marginTop: 2,
  },
  planSubSelected: {
    color: colors.primary,
  },
  featureList: {
    gap: 14,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  featureIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  featureText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
    flex: 1,
    letterSpacing: 0.2,
  },
  footer: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 8,
    paddingTop: 12,
  },
  ctaButton: {
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  ctaText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: '#fff',
    letterSpacing: 0.5,
  },
  renewalNote: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 15,
    letterSpacing: 0.2,
    textAlign: 'center',
    marginTop: 10,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 10,
  },
  linkText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textTertiary,
    letterSpacing: 0.3,
  },
  linkSeparator: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
    opacity: 0.5,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 6,
  },
  skipText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textTertiary,
    letterSpacing: 0.3,
  },
});
