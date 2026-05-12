import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
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
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { analytics, EVENTS, type PaywallSource } from '../../services/analytics';
import { colors, fonts, spacing } from '../../theme';

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
  const { showPaywall, paywallSource, closePaywall, upgrade } = useSubscriptionStore();
  const [selectedPlan, setSelectedPlan] = useState<Plan>('annual');

  // Track the open timestamp + active source for analytics. Use refs so a
  // re-render doesn't fire spurious events; the open event must fire exactly
  // once per paywall open, regardless of re-render churn.
  const openedAtRef = useRef<number | null>(null);
  const activeSourceRef = useRef<PaywallSource | null>(null);
  // Set to true when the modal closes due to a successful purchase, so the
  // dismiss event doesn't fire in addition to purchase_completed.
  const dismissByPurchaseRef = useRef(false);

  // Fire paywall_shown exactly once on open
  useEffect(() => {
    if (showPaywall && paywallSource && openedAtRef.current === null) {
      openedAtRef.current = Date.now();
      activeSourceRef.current = paywallSource;
      analytics.track(EVENTS.paywall_shown, {
        source: paywallSource,
        default_plan: selectedPlan,
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

  const handlePurchase = () => {
    analytics.track(EVENTS.paywall_cta_tapped, {
      plan: selectedPlan,
      source: activeSourceRef.current ?? 'manual',
    });

    // TODO: Replace with RevenueCat purchase flow
    // const pkg = selectedPlan === 'annual' ? annualPackage : monthlyPackage;
    // Purchases.purchasePackage(pkg).then(() => upgrade());
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
              source: activeSourceRef.current ?? 'manual',
            });
          },
        },
        {
          text: 'Subscribe',
          onPress: () => {
            analytics.track(EVENTS.purchase_started, {
              plan: selectedPlan,
              source: activeSourceRef.current ?? 'manual',
            });
            // For now, upgrade is synchronous (dev/test). Once RC is wired
            // this will become async and we'll only fire purchase_completed
            // after the RC promise resolves with success.
            upgrade();
            dismissByPurchaseRef.current = true;
            analytics.track(EVENTS.purchase_completed, {
              plan: selectedPlan,
              source: activeSourceRef.current ?? 'manual',
            });
          },
        },
      ],
    );
  };

  const handleRestore = () => {
    analytics.track(EVENTS.paywall_restore_tapped, {
      source: activeSourceRef.current ?? 'manual',
    });
    // TODO: RevenueCat restore purchases
    Alert.alert('Restore Purchases', 'No previous purchases found.');
  };

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open link.'));
  };

  return (
    <Modal
      visible={showPaywall}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleDismiss}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={handleDismiss}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="close" size={22} color={colors.textTertiary} />
        </TouchableOpacity>

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
              <Text
                style={[styles.planLabel, selectedPlan === 'annual' && styles.planLabelSelected]}
              >
                Annual
              </Text>
              {/* Anchor price — $4.99 × 12 = $59.88. Honest comparison vs. paying
                  monthly for a year. Provides the savings frame without
                  inventing a fictional "regular price." */}
              <Text style={styles.planAnchor}>$59.88</Text>
              <Text
                style={[styles.planPrice, selectedPlan === 'annual' && styles.planPriceSelected]}
              >
                $35
              </Text>
              <Text style={[styles.planPer, selectedPlan === 'annual' && styles.planPerSelected]}>
                per year
              </Text>
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
              <Text
                style={[styles.planPrice, selectedPlan === 'monthly' && styles.planPriceSelected]}
              >
                $4.99
              </Text>
              <Text style={[styles.planPer, selectedPlan === 'monthly' && styles.planPerSelected]}>
                per month
              </Text>
              <Text style={[styles.planSub, selectedPlan === 'monthly' && styles.planSubSelected]}>
                cancel anytime
              </Text>
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
          <TouchableOpacity style={styles.ctaButton} onPress={handlePurchase} activeOpacity={0.85}>
            <Ionicons name="flash" size={18} color="#fff" />
            <Text style={styles.ctaText}>
              {selectedPlan === 'annual' ? 'Start for $35 / year' : 'Start for $4.99 / month'}
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

          {/* Link row — Terms · Privacy · Restore */}
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
        </View>
      </SafeAreaView>
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
    flexDirection: 'row',
    gap: 12,
  },
  planCard: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 18,
    // Asymmetric vertical padding — extra top space gives the floating
    // "SAVE 42%" badge breathing room above the plan label so it doesn't
    // visually cramp into the "Annual" text underneath.
    paddingTop: 22,
    paddingBottom: 18,
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    // Bumped to accommodate the strikethrough anchor row. Cards stretch
    // to equal height because the parent row is alignItems: 'stretch'
    // by default in flex row, so Monthly will match Annual's height and
    // center its content within the extra space.
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
  // Strikethrough anchor — small, muted, sits above the discounted price.
  // textDecorationColor matches the text so the line is the same hue (no
  // visual mismatch) but stays subordinate to the big price below.
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
});
