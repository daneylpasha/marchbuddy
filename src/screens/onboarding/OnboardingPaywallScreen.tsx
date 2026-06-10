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
  Modal,
  Platform,
} from 'react-native';
import { showAppDialog } from '../../services/appDialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { useCoachSetupStore } from '../../store/coachSetupStore';
import { useAuthStore } from '../../store/authStore';
import { analytics, EVENTS } from '../../services/analytics';
import { authService } from '../../services/authService';
import { purchasesService } from '../../services/purchasesService';
import { colors, fonts, spacing } from '../../theme';
import type { OnboardingStackParamList } from '../../navigation/AppNavigator';
import PrivacyPolicyScreen from '../settings/PrivacyPolicyScreen';
import TermsOfServiceScreen from '../settings/TermsOfServiceScreen';
import ContactSupportSheet, {
  type ContactSupportSheetRef,
} from '../../components/settings/ContactSupportSheet';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'OnboardingPaywall'>;
type Plan = 'monthly' | 'annual';

// Format a number as currency in the store's reported currency, using the
// device locale for grouping/decimal conventions. Falls back to a plain
// "CODE 12.34" string if Intl can't handle the currency (older RN engines).
function formatCurrency(amount: number, currencyCode: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currencyCode} ${amount.toFixed(2)}`;
  }
}

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

  const [selectedPlan, setSelectedPlan] = useState<Plan>('annual');
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [legalScreen, setLegalScreen] = useState<'privacy' | 'terms' | null>(null);
  const supportSheetRef = useRef<ContactSupportSheetRef>(null);
  const openedAtRef = useRef<number>(Date.now());

  // Defensive: CoachSetupScreen already routes guests past this screen
  // (markSetupComplete + return). If a guest still lands here somehow
  // (e.g. a future entry point), finalize immediately so they don't see
  // a paywall they can't transact on.
  useEffect(() => {
    if (useAuthStore.getState().isGuest) {
      markSetupComplete();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fire paywall_shown once on mount. Source is hardcoded since this screen
  // only exists for the onboarding entry point.
  useEffect(() => {
    analytics.track(EVENTS.paywall_shown, {
      source: 'onboarding',
      default_plan: selectedPlan,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load RC offering for localized prices + real purchase packages.
  useEffect(() => {
    purchasesService.getCurrentOffering().then((o) => {
      if (o) setOffering(o);
    });
  }, []);

  // Resolve the active package + display strings (with fallbacks for
  // when RC hasn't loaded yet, e.g. offline or pre-init).
  const annualPackage: PurchasesPackage | null = offering?.annual ?? null;
  const monthlyPackage: PurchasesPackage | null = offering?.monthly ?? null;
  const selectedPackage = selectedPlan === 'annual' ? annualPackage : monthlyPackage;
  const annualPriceString = annualPackage?.product.priceString ?? '$35';
  const monthlyPriceString = monthlyPackage?.product.priceString ?? '$4.99';

  // Derived prices that must match the store's currency (PKR, EUR, INR, etc).
  // Anchor = monthly × 12 (honest comparison vs paying monthly for a year).
  // Per-month breakdown = annual ÷ 12.
  const anchorPriceString = monthlyPackage
    ? formatCurrency(monthlyPackage.product.price * 12, monthlyPackage.product.currencyCode)
    : '$59.88';
  const annualPerMonthString = annualPackage
    ? formatCurrency(annualPackage.product.price / 12, annualPackage.product.currencyCode)
    : '$2.92';

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

  const handlePurchase = async () => {
    analytics.track(EVENTS.paywall_cta_tapped, {
      plan: selectedPlan,
      source: 'onboarding',
    });

    if (!selectedPackage) {
      showAppDialog(
        'Cannot complete purchase',
        'We could not load the subscription products. Please check your internet connection and try again.',
      );
      return;
    }

    analytics.track(EVENTS.purchase_started, {
      plan: selectedPlan,
      source: 'onboarding',
    });

    setIsPurchasing(true);
    const result = await purchasesService.purchasePackage(selectedPackage);
    setIsPurchasing(false);

    if (result.ok) {
      analytics.track(EVENTS.purchase_completed, {
        plan: selectedPlan,
        source: 'onboarding',
      });
      // purchasesService already flipped local tier to 'pro' via the
      // CustomerInfo listener. Now finalize onboarding so the user
      // lands in MainTab as a Pro user.
      await finalizeOnboarding();
      return;
    }

    if (result.userCancelled) {
      analytics.track(EVENTS.purchase_cancelled, {
        plan: selectedPlan,
        source: 'onboarding',
      });
      // No alert — they explicitly chose to back out.
      return;
    }

    analytics.track(EVENTS.purchase_failed, {
      plan: selectedPlan,
      source: 'onboarding',
      reason: result.error ?? 'unknown',
    });
    showAppDialog(
      'Purchase failed',
      result.error ?? 'Something went wrong with the purchase. Please try again in a moment.',
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

  const handleRestore = async () => {
    analytics.track(EVENTS.paywall_restore_tapped, { source: 'onboarding' });

    const { restored } = await purchasesService.restorePurchases();

    if (restored) {
      analytics.track(EVENTS.subscription_restored);
      // The restore succeeded — they're already a Pro user. Finalize
      // onboarding and let them into the app.
      showAppDialog(
        'Welcome back',
        'Your MarchBuddy Pro subscription has been restored.',
        [{ text: 'OK', onPress: () => finalizeOnboarding() }],
      );
    } else {
      showAppDialog(
        'No purchases found',
        'We could not find any previous MarchBuddy Pro purchases on this account. If you believe this is an error, contact support.',
      );
    }
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
            <View style={styles.planCardLeft}>
              <Text
                style={[styles.planLabel, selectedPlan === 'annual' && styles.planLabelSelected]}
              >
                Annual
              </Text>
              {/* Anchor price — monthly × 12 (honest comparison vs paying
                  monthly for a year). Currency matches the store locale. */}
              <Text style={styles.planAnchor}>{anchorPriceString}</Text>
              <Text style={[styles.planSub, selectedPlan === 'annual' && styles.planSubSelected]}>
                ~{annualPerMonthString} / month
              </Text>
            </View>
            <View style={styles.planCardRight}>
              <Text style={styles.planPrice}>{annualPriceString}</Text>
              <Text style={styles.planPer}>per year</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.planCard, selectedPlan === 'monthly' && styles.planCardSelected]}
            onPress={() => handleSelectPlan('monthly')}
            activeOpacity={0.8}
          >
            <View style={styles.planCardLeft}>
              <Text
                style={[styles.planLabel, selectedPlan === 'monthly' && styles.planLabelSelected]}
              >
                Monthly
              </Text>
              <Text style={[styles.planSub, selectedPlan === 'monthly' && styles.planSubSelected]}>
                cancel anytime
              </Text>
            </View>
            <View style={styles.planCardRight}>
              <Text style={styles.planPrice}>{monthlyPriceString}</Text>
              <Text style={styles.planPer}>per month</Text>
            </View>
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
        <TouchableOpacity
          style={[styles.ctaButton, (isPurchasing || !selectedPackage) && styles.ctaButtonDisabled]}
          onPress={handlePurchase}
          activeOpacity={0.85}
          disabled={isPurchasing || !selectedPackage}
        >
          <Ionicons name="flash" size={18} color="#fff" />
          <Text style={styles.ctaText}>
            {isPurchasing
              ? 'Processing...'
              : selectedPlan === 'annual'
                ? `Start with Pro — ${annualPriceString} / year`
                : `Start with Pro — ${monthlyPriceString} / month`}
          </Text>
        </TouchableOpacity>

        <Text style={styles.renewalNote}>
          {Platform.OS === 'ios'
            ? 'Auto-renews until canceled. Manage in your App Store account settings.'
            : 'Auto-renews until canceled. Manage in Google Play subscriptions.'}
        </Text>

        <View style={styles.linkRow}>
          <TouchableOpacity
            onPress={() => setLegalScreen('terms')}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            accessibilityRole="link"
            accessibilityLabel="Terms of Service"
          >
            <Text style={styles.linkText}>Terms</Text>
          </TouchableOpacity>
          <Text style={styles.linkSeparator}>·</Text>
          <TouchableOpacity
            onPress={() => setLegalScreen('privacy')}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            accessibilityRole="link"
            accessibilityLabel="Privacy Policy"
          >
            <Text style={styles.linkText}>Privacy</Text>
          </TouchableOpacity>
          <Text style={styles.linkSeparator}>·</Text>
          <TouchableOpacity
            onPress={() => supportSheetRef.current?.present()}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            accessibilityRole="button"
            accessibilityLabel="Contact Support"
          >
            <Text style={styles.linkText}>Support</Text>
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

      <Modal
        visible={legalScreen === 'privacy'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setLegalScreen(null)}
      >
        <PrivacyPolicyScreen onClose={() => setLegalScreen(null)} />
      </Modal>

      <Modal
        visible={legalScreen === 'terms'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setLegalScreen(null)}
      >
        <TermsOfServiceScreen onClose={() => setLegalScreen(null)} />
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
    flexDirection: 'column',
    gap: 12,
  },
  planCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 18,
    // Asymmetric vertical padding — extra top space for the floating
    // "SAVE 42%" badge above the Annual label.
    paddingTop: 18,
    paddingBottom: 16,
    paddingHorizontal: 18,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
  },
  planCardLeft: {
    flex: 1,
    gap: 2,
    alignItems: 'flex-start',
  },
  planCardRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  planCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDim,
  },
  saveBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
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
    fontSize: 14,
    color: colors.textTertiary,
    letterSpacing: 0.3,
  },
  planLabelSelected: {
    color: colors.primary,
  },
  // Strikethrough anchor — sits under the plan label. Honest comparison
  // vs. paying monthly for a year.
  planAnchor: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
    letterSpacing: 0.2,
    textDecorationLine: 'line-through',
    textDecorationColor: colors.textMuted,
  },
  planPrice: {
    fontFamily: fonts.bold,
    fontSize: 28,
    color: colors.textPrimary,
    letterSpacing: 0.3,
    lineHeight: 32,
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
  ctaButtonDisabled: {
    opacity: 0.5,
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
