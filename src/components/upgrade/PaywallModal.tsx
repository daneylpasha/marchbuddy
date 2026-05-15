import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import type { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { useAuthStore } from '../../store/authStore';
import { analytics, EVENTS, type PaywallSource } from '../../services/analytics';
import { purchasesService } from '../../services/purchasesService';
import ConfirmDialog from '../common/ConfirmDialog';
import PrivacyPolicyScreen from '../../screens/settings/PrivacyPolicyScreen';
import TermsOfServiceScreen from '../../screens/settings/TermsOfServiceScreen';
import ContactSupportSheet, {
  type ContactSupportSheetRef,
} from '../settings/ContactSupportSheet';
import { colors, fonts, spacing } from '../../theme';

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
  { icon: 'checkmark-circle' as const, text: 'Personalized AI feedback after every session' },
  { icon: 'people' as const, text: 'Full community — challenges, teams & buddies' },
  { icon: 'trophy' as const, text: 'All 18 milestones + shareable achievement cards' },
  { icon: 'star' as const, text: 'Early access to new features as they ship' },
];

type Plan = 'monthly' | 'annual';

export function PaywallModal() {
  const { showPaywall, paywallSource, closePaywall } = useSubscriptionStore();
  const isGuest = useAuthStore((s) => s.isGuest);
  const exitGuestMode = useAuthStore((s) => s.exitGuestMode);
  const [selectedPlan, setSelectedPlan] = useState<Plan>('annual');
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [noPurchasesDialog, setNoPurchasesDialog] = useState(false);
  const [legalScreen, setLegalScreen] = useState<'privacy' | 'terms' | null>(null);
  const supportSheetRef = useRef<ContactSupportSheetRef>(null);

  // Track the open timestamp + active source for analytics. Use refs so a
  // re-render doesn't fire spurious events; the open event must fire exactly
  // once per paywall open, regardless of re-render churn.
  const openedAtRef = useRef<number | null>(null);
  const activeSourceRef = useRef<PaywallSource | null>(null);
  // Set to true when the modal closes due to a successful purchase, so the
  // dismiss event doesn't fire in addition to purchase_completed.
  const dismissByPurchaseRef = useRef(false);

  // Load the current RC offering when the modal opens. This gives us
  // localized prices, trial info, and the actual PurchasesPackage objects
  // we need to initiate purchases. Cached after first load.
  useEffect(() => {
    if (!showPaywall) return;
    // Guests can't purchase (no real user to attach entitlement to) — they
    // see the sign-in prompt instead, so don't waste a network round-trip
    // fetching offerings they can't act on.
    if (isGuest) return;
    if (offering) return; // already loaded
    purchasesService.getCurrentOffering().then((o) => {
      if (o) setOffering(o);
    });
  }, [showPaywall, offering, isGuest]);

  // Resolve the selected plan into an actual RC package. Used by the
  // purchase button to know what to charge. If RC offerings haven't
  // loaded (network failure, not configured), this returns null and the
  // UI shows fallback hardcoded prices + a non-functional button.
  const annualPackage: PurchasesPackage | null = offering?.annual ?? null;
  const monthlyPackage: PurchasesPackage | null = offering?.monthly ?? null;
  const selectedPackage = selectedPlan === 'annual' ? annualPackage : monthlyPackage;

  // Prefer prices from RC products (auto-localized to user's locale +
  // currency). Fall back to hardcoded USD if RC isn't loaded yet.
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

  // Fire paywall_shown exactly once on open
  useEffect(() => {
    if (showPaywall && paywallSource && openedAtRef.current === null) {
      openedAtRef.current = Date.now();
      activeSourceRef.current = paywallSource;
      analytics.track(EVENTS.paywall_shown, {
        source: paywallSource,
        default_plan: selectedPlan,
        // Guests see a gated "sign in to unlock Pro" view instead of the
        // real paywall. Track it so the conversion funnel can split them.
        requires_signin: isGuest,
      });
    }
    // Reset refs when modal closes so the next open fires shown again
    if (!showPaywall && openedAtRef.current !== null) {
      openedAtRef.current = null;
      activeSourceRef.current = null;
      dismissByPurchaseRef.current = false;
    }
  }, [showPaywall, paywallSource]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDismiss = () => {
    // Only fire dismissed if the modal is being closed by the user (not by
    // a successful purchase, which fires purchase_completed instead).
    if (!dismissByPurchaseRef.current && openedAtRef.current) {
      analytics.track(EVENTS.paywall_dismissed, {
        source: activeSourceRef.current ?? 'manual',
        time_visible_ms: Date.now() - openedAtRef.current,
        last_plan_selected: selectedPlan,
      });
    }
    closePaywall();
  };

  const handleSelectPlan = (plan: Plan) => {
    if (plan === selectedPlan) return;
    setSelectedPlan(plan);
    analytics.track(EVENTS.paywall_plan_selected, { plan });
  };

  // Guest path: exit guest mode so AppNavigator routes to the standalone
  // LoginScreen. Their on-device data is preserved (exitGuestMode only
  // flips auth flags); after they sign in, authStore.syncLocalDataToSupabase
  // migrates it to the new account.
  const handleSignInToUnlock = () => {
    analytics.track(EVENTS.paywall_cta_tapped, {
      plan: 'signin_required',
      source: activeSourceRef.current ?? 'manual',
    });
    closePaywall();
    exitGuestMode();
  };

  const handlePurchase = async () => {
    analytics.track(EVENTS.paywall_cta_tapped, {
      plan: selectedPlan,
      source: activeSourceRef.current ?? 'manual',
    });

    if (!selectedPackage) {
      Alert.alert(
        'Cannot complete purchase',
        'We could not load the subscription products. Please check your internet connection and try again.',
      );
      return;
    }

    analytics.track(EVENTS.purchase_started, {
      plan: selectedPlan,
      source: activeSourceRef.current ?? 'manual',
    });

    setIsPurchasing(true);
    const result = await purchasesService.purchasePackage(selectedPackage);
    setIsPurchasing(false);

    if (result.ok) {
      // purchasesService.syncCustomerInfoToStore() has already flipped
      // the local tier to 'pro' via the CustomerInfo listener. The
      // RevenueCat webhook (Supabase Edge Function) will also fire and
      // update the server-side tier — eventually consistent.
      dismissByPurchaseRef.current = true;
      analytics.track(EVENTS.purchase_completed, {
        plan: selectedPlan,
        source: activeSourceRef.current ?? 'manual',
      });
      // Close the modal so the user lands back on whatever screen they
      // came from — already as a Pro user.
      closePaywall();
      return;
    }

    if (result.userCancelled) {
      analytics.track(EVENTS.purchase_cancelled, {
        plan: selectedPlan,
        source: activeSourceRef.current ?? 'manual',
      });
      // No alert — user explicitly chose to back out, no need to nag.
      return;
    }

    // Real failure (network, declined card, etc.)
    analytics.track(EVENTS.purchase_failed, {
      plan: selectedPlan,
      source: activeSourceRef.current ?? 'manual',
      reason: result.error ?? 'unknown',
    });
    Alert.alert(
      'Purchase failed',
      result.error ?? 'Something went wrong with the purchase. Please try again in a moment.',
    );
  };

  const handleRestore = async () => {
    analytics.track(EVENTS.paywall_restore_tapped, {
      source: activeSourceRef.current ?? 'manual',
    });

    const { restored } = await purchasesService.restorePurchases();

    if (restored) {
      analytics.track(EVENTS.subscription_restored);
      Alert.alert(
        'Welcome back',
        'Your MarchBuddy Pro subscription has been restored.',
        [{ text: 'OK', onPress: () => closePaywall() }],
      );
    } else {
      setNoPurchasesDialog(true);
    }
  };


  return (
    <Modal
      visible={showPaywall}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleDismiss}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={handleDismiss}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="close" size={22} color={colors.textTertiary} />
        </TouchableOpacity>

        {isGuest ? (
          // Guest gate — purchases can't be attached to an anonymous user,
          // so we never show the real paywall. Instead, prompt them to sign
          // in. After sign-in, syncLocalDataToSupabase migrates their guest
          // progress to the new account, and the next Pro CTA tap shows the
          // real paywall.
          <View style={styles.guestContainer}>
            <View style={styles.iconRing}>
              <Ionicons name="lock-closed" size={32} color={colors.primary} />
            </View>
            <Text style={styles.guestHeadline}>Sign in to unlock Pro</Text>
            <Text style={styles.guestBody}>
              MarchBuddy Pro is tied to your account. Sign in to keep your progress safe — then
              upgrade and unlock the full coach.
            </Text>
            <View style={styles.guestMigrationNote}>
              <Ionicons name="shield-checkmark" size={14} color={colors.primary} />
              <Text style={styles.guestMigrationText}>
                Your current progress will move with you when you sign in.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.guestCta}
              onPress={handleSignInToUnlock}
              activeOpacity={0.85}
            >
              <Ionicons name="log-in" size={18} color="#fff" />
              <Text style={styles.ctaText}>Sign in to continue</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleDismiss}
              style={styles.guestNotNowBtn}
              hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
            >
              <Text style={styles.guestNotNowText}>Not now</Text>
            </TouchableOpacity>
          </View>
        ) : (
        <>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconRing}>
              <Ionicons name="flash" size={34} color={colors.primary} />
            </View>
            <Text style={styles.headline}>UNLOCK</Text>
            <Text style={styles.subheadline}>MarchBuddy Pro</Text>
            <Text style={styles.tagline}>Your full AI fitness coach. No limits.</Text>
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
                {/* Anchor price — monthly × 12. Honest comparison vs. paying
                    monthly for a year. Provides the savings frame without
                    inventing a fictional "regular price." Currency matches
                    the store locale. */}
                <Text style={styles.planAnchor}>{anchorPriceString}</Text>
                <Text style={[styles.planSub, selectedPlan === 'annual' && styles.planSubSelected]}>
                  ~{annualPerMonthString} / month
                </Text>
              </View>
              <View style={styles.planCardRight}>
                <Text
                  style={[styles.planPrice, selectedPlan === 'annual' && styles.planPriceSelected]}
                >
                  {annualPriceString}
                </Text>
                <Text style={[styles.planPer, selectedPlan === 'annual' && styles.planPerSelected]}>
                  per year
                </Text>
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
                <Text
                  style={[styles.planPrice, selectedPlan === 'monthly' && styles.planPriceSelected]}
                >
                  {monthlyPriceString}
                </Text>
                <Text style={[styles.planPer, selectedPlan === 'monthly' && styles.planPerSelected]}>
                  per month
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Feature list */}
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

          {/* Founder note */}
          <View style={styles.founderNote}>
            <Ionicons name="lock-closed" size={13} color={colors.textTertiary} />
            <Text style={styles.founderText}>
              Founding member pricing — locked in for life. Price rises as the app grows.
            </Text>
          </View>
        </ScrollView>

        {/* Footer CTA */}
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
                  ? `Start for ${annualPriceString} / year`
                  : `Start for ${monthlyPriceString} / month`}
            </Text>
          </TouchableOpacity>

          {/* Compressed auto-renewal disclosure — required by both App Store
              (3.1.2) and Google Play. Wording is platform-aware so Android
              users get pointed to Google Play and iOS users get pointed to
              App Store account settings. */}
          <Text style={styles.renewalNote}>
            {Platform.OS === 'ios'
              ? 'Auto-renews until canceled. Manage in your App Store account settings.'
              : 'Auto-renews until canceled. Manage in Google Play subscriptions.'}
          </Text>

          {/* Link row — Terms · Privacy · Support · Restore */}
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
        </View>
        </>
        )}
        <ConfirmDialog
          visible={noPurchasesDialog}
          icon="search-outline"
          title="No purchases found"
          message="We could not find any previous MarchBuddy Pro purchases on this account. If you believe this is an error, contact support."
          confirmLabel="OK"
          cancelLabel="Close"
          onCancel={() => setNoPurchasesDialog(false)}
          onConfirm={() => setNoPurchasesDialog(false)}
        />
      </SafeAreaView>

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
      </BottomSheetModalProvider>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  closeBtn: {
    position: 'absolute',
    top: 52,
    right: 20,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 24,
    paddingBottom: 24,
    gap: 24,
  },
  header: {
    alignItems: 'center',
    paddingTop: 16,
    gap: 8,
  },
  iconRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryDim,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  headline: {
    fontFamily: fonts.titleRegular,
    fontSize: 48,
    color: colors.primary,
    letterSpacing: 2,
    lineHeight: 52,
  },
  subheadline: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.textPrimary,
    letterSpacing: 0.3,
    marginTop: -4,
  },
  tagline: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textSecondary,
    letterSpacing: 0.2,
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
    // Asymmetric vertical padding — extra top space gives the floating
    // "SAVE 42%" badge breathing room above the plan label so it doesn't
    // visually cramp into the "Annual" text underneath.
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
  // Strikethrough anchor — sits under the plan label on the left column.
  // textDecorationColor matches the text so the line is the same hue.
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
  planPriceSelected: {
    color: colors.textPrimary,
  },
  planPer: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textTertiary,
    letterSpacing: 0.2,
  },
  planPerSelected: {
    color: colors.textSecondary,
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
  founderNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  founderText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textTertiary,
    lineHeight: 18,
    flex: 1,
    letterSpacing: 0.2,
  },
  footer: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 8,
    paddingTop: 12,
    gap: 4,
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
    paddingBottom: 4,
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
  // ── Guest sign-in gate ────────────────────────────────────────────────
  // Centered single column — content + CTA sit together vertically so the
  // modal doesn't leave a dead band of black space between them.
  guestContainer: {
    flex: 1,
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestHeadline: {
    fontFamily: fonts.bold,
    fontSize: 24,
    color: colors.textPrimary,
    letterSpacing: 0.3,
    textAlign: 'center',
    marginTop: 24,
  },
  guestBody: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
    letterSpacing: 0.2,
    textAlign: 'center',
    marginTop: 12,
    maxWidth: 320,
  },
  guestMigrationNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primaryDim,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 24,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.2)',
    alignSelf: 'stretch',
  },
  guestMigrationText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textSecondary,
    letterSpacing: 0.2,
    flexShrink: 1,
  },
  guestCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'stretch',
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: 14,
    marginTop: 28,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  guestNotNowBtn: {
    paddingVertical: 14,
    marginTop: 8,
    alignItems: 'center',
  },
  guestNotNowText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textTertiary,
    letterSpacing: 0.3,
  },
});
