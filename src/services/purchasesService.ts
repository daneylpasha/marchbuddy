// services/purchasesService.ts — RevenueCat SDK wrapper
//
// Why wrap RC directly:
//   1. Keep RC swappable — paywall code shouldn't know whether purchases
//      are handled by RC, StoreKit directly, or a future provider.
//   2. Centralize error handling — RC throws differently than typical
//      JS errors; we normalize to a consistent shape.
//   3. Tie RC user identity to our app user — so cross-device entitlement
//      restoration works automatically on sign-in.
//   4. Sync entitlement state back to our subscriptionStore — single
//      source of truth on the client side, with Supabase as the durable
//      source on the server.
//
// Flow on a successful purchase:
//   1. User taps "Subscribe" → purchasesService.purchasePackage(pkg)
//   2. RC SDK opens Google Play purchase UI
//   3. User confirms purchase in Play UI
//   4. RC returns CustomerInfo with entitlement.pro active
//   5. We call subscriptionStore.upgrade() which:
//      - Flips local tier to 'pro' (UI reflects immediately)
//      - Pushes to Supabase user_subscriptions (server-side mirror)
//   6. Meanwhile, RC's webhook fires to our Supabase Edge Function
//      (built separately) which is the authoritative writer of tier
//      based on the actual Play Store receipt.
//   7. Next time the app pulls subscription from server, both client and
//      server are in sync.

import Purchases, {
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
  LOG_LEVEL,
} from 'react-native-purchases';
import { Platform } from 'react-native';
import { REVENUECAT_ANDROID_KEY, REVENUECAT_IOS_KEY } from '../config/env';

// Entitlement identifier — must match what's configured in RevenueCat
// dashboard. If you rename in RC, rename here too.
export const PRO_ENTITLEMENT = 'pro';

// Offering identifier — must match what's configured in RevenueCat.
// We use the "default" offering which contains both the annual and
// monthly packages.
export const DEFAULT_OFFERING = 'default';

class PurchasesService {
  private isConfigured = false;
  private currentUserId: string | null = null;

  /**
   * Initialize the RevenueCat SDK with the platform-appropriate API key.
   * Idempotent — safe to call multiple times. Returns early if a key
   * isn't configured (e.g. dev environment) or if already initialized.
   *
   * Call this once at app startup, before any other RC method.
   */
  async configure(): Promise<void> {
    if (this.isConfigured) return;

    const apiKey = Platform.OS === 'ios' ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY;
    if (!apiKey) {
      console.warn(
        '[purchases] No RevenueCat API key configured for platform ' +
          Platform.OS +
          '. Skipping init — purchases will be unavailable.',
      );
      return;
    }

    try {
      // Optional verbose logging in dev — surfaces RC's internal state
      // when debugging purchase flows. Switch to WARN or off for prod.
      if (__DEV__) {
        Purchases.setLogLevel(LOG_LEVEL.WARN);
      }

      Purchases.configure({ apiKey });
      this.isConfigured = true;

      // Listen for entitlement changes (e.g. webhook updates pushed by RC
      // server to active devices). Whenever the user's pro status flips,
      // sync it to our subscriptionStore so the UI updates instantly.
      Purchases.addCustomerInfoUpdateListener((customerInfo) => {
        this.syncCustomerInfoToStore(customerInfo);
      });
    } catch (err) {
      console.warn('[purchases] configure failed:', err);
    }
  }

  /**
   * Associate the RevenueCat user with our authenticated app user.
   * Call this whenever the user signs in. RevenueCat will merge any
   * anonymous purchases into the authenticated identity.
   *
   * Without this, RC tracks users by anonymous device IDs and entitlements
   * don't survive a fresh install / new device sign-in.
   */
  async identifyUser(userId: string): Promise<void> {
    if (!this.isConfigured) return;
    if (this.currentUserId === userId) return;

    try {
      const result = await Purchases.logIn(userId);
      this.currentUserId = userId;
      // logIn returns the latest customerInfo — sync it immediately so
      // existing entitlements reflect in our store.
      this.syncCustomerInfoToStore(result.customerInfo);
    } catch (err) {
      console.warn('[purchases] identifyUser failed:', err);
    }
  }

  /**
   * Disassociate the current user. Call on signOut/deleteAccount so a
   * subsequent sign-in on this device doesn't inherit the previous
   * user's purchase history attribution.
   */
  async resetUser(): Promise<void> {
    if (!this.isConfigured) return;
    try {
      await Purchases.logOut();
      this.currentUserId = null;
    } catch (err) {
      console.warn('[purchases] resetUser failed:', err);
    }
  }

  /**
   * Fetch the current offering — the bundle of packages (Annual + Monthly)
   * the user can purchase. Returns null if offerings can't be fetched
   * (no RC config, no network, no offerings defined yet).
   */
  async getCurrentOffering(): Promise<PurchasesOffering | null> {
    if (!this.isConfigured) return null;
    try {
      const offerings = await Purchases.getOfferings();
      return offerings.current ?? null;
    } catch (err) {
      console.warn('[purchases] getCurrentOffering failed:', err);
      return null;
    }
  }

  /**
   * Initiate a purchase. Opens the platform's native purchase UI.
   *
   * Returns:
   *   • { ok: true, customerInfo } on successful purchase
   *   • { ok: false, userCancelled: true } if the user dismissed the UI
   *   • { ok: false, error } on any other failure (network, declined card, etc.)
   *
   * On success, also syncs the new entitlement state to subscriptionStore
   * so the UI updates immediately without waiting for the webhook.
   */
  async purchasePackage(pkg: PurchasesPackage): Promise<PurchaseResult> {
    if (!this.isConfigured) {
      return { ok: false, userCancelled: false, error: 'RevenueCat not configured' };
    }

    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      this.syncCustomerInfoToStore(customerInfo);
      return { ok: true, customerInfo };
    } catch (err: unknown) {
      // RC errors have a `userCancelled` flag — we surface that distinctly
      // because user cancellation is not a real "failure" and shouldn't
      // show error UI.
      const e = err as { userCancelled?: boolean; message?: string };
      if (e?.userCancelled) {
        return { ok: false, userCancelled: true };
      }
      console.warn('[purchases] purchasePackage failed:', err);
      return { ok: false, userCancelled: false, error: e?.message ?? 'Unknown error' };
    }
  }

  /**
   * Restore previous purchases. Used by the "Restore" button on the paywall
   * for users who reinstalled the app, switched devices, or had a billing
   * disruption.
   *
   * Returns true if any active entitlement was restored, false otherwise.
   */
  async restorePurchases(): Promise<{ restored: boolean; customerInfo?: CustomerInfo }> {
    if (!this.isConfigured) return { restored: false };

    try {
      const customerInfo = await Purchases.restorePurchases();
      const hasPro = !!customerInfo.entitlements.active[PRO_ENTITLEMENT];
      this.syncCustomerInfoToStore(customerInfo);
      return { restored: hasPro, customerInfo };
    } catch (err) {
      console.warn('[purchases] restorePurchases failed:', err);
      return { restored: false };
    }
  }

  /**
   * Internal: take a CustomerInfo from RC and reflect its entitlement
   * state into our subscriptionStore. Called from configure() listener,
   * identifyUser(), purchasePackage(), and restorePurchases().
   *
   * Important: this updates the LOCAL store. The Supabase server-side
   * tier is updated independently by the RC webhook (Edge Function).
   * Eventually consistent — usually within seconds.
   */
  private syncCustomerInfoToStore(customerInfo: CustomerInfo): void {
    try {
      const { useSubscriptionStore } = require('../store/subscriptionStore');
      const proEntitlement = customerInfo.entitlements.active[PRO_ENTITLEMENT];
      const isPro = !!proEntitlement;

      if (isPro) {
        // Entitlement is active — flip to Pro
        useSubscriptionStore.getState().upgrade();
      }
      // Note: we deliberately do NOT auto-downgrade here. If RC says the
      // user no longer has Pro (e.g. subscription expired), we wait for
      // the server-side webhook + the next pull to sync. This protects
      // against transient RC errors causing UI to briefly show as 'free'
      // for a paying user.
    } catch (err) {
      console.warn('[purchases] syncCustomerInfoToStore failed:', err);
    }
  }
}

export type PurchaseResult =
  | { ok: true; customerInfo: CustomerInfo }
  | { ok: false; userCancelled: boolean; error?: string };

export const purchasesService = new PurchasesService();
