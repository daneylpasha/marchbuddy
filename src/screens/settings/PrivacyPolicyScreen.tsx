import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing } from '../../theme';

const LAST_UPDATED = 'May 14, 2026';

export default function PrivacyPolicyScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          Your privacy is important to us. This Privacy Policy explains what data MarchBuddy
          collects, how we use it, who we share it with, and the choices you have. It applies to
          everything you do inside the MarchBuddy mobile app.
        </Text>
        <Text style={styles.meta}>Last updated: {LAST_UPDATED}</Text>

        <Section title="1. Information We Collect">
          <Paragraph>
            We collect only the data we need to provide a useful, personalized fitness experience.
            Specifically:
          </Paragraph>

          <SubHeading>Account & Identity</SubHeading>
          <BulletItem>
            <Bold>Email address</Bold> and authentication credentials when you create an account.
          </BulletItem>
          <BulletItem>
            <Bold>Account ID</Bold> (a randomly generated identifier) used to associate your data
            with you on our servers.
          </BulletItem>

          <SubHeading>Onboarding & Coaching Profile</SubHeading>
          <BulletItem>
            The name you want your coach to use, your activity level, preferred workout times, and
            other goal-related answers (trigger statement, past failure reason, primary fear,
            anchor person, success vision, start preference, weekly frequency).
          </BulletItem>
          <BulletItem>
            We use this only to personalize your coaching plans and AI coach responses — not for
            advertising or any third-party marketing.
          </BulletItem>

          <SubHeading>Workout & Progress Data</SubHeading>
          <BulletItem>
            Sessions you complete (date, duration, distance, level, segments).
          </BulletItem>
          <BulletItem>
            Plan feedback you submit ("too easy", "just right", "challenging", "too hard").
          </BulletItem>
          <BulletItem>
            Streaks, current level, milestones unlocked, weekly summaries, and personal records.
          </BulletItem>
          <BulletItem>Scheduled sessions and rest days you declare.</BulletItem>

          <SubHeading>Location Data (Outdoor Sessions Only)</SubHeading>
          <BulletItem>
            For outdoor runs/walks, we record GPS coordinates while a session is actively running.
            This is used to draw your route map, measure distance, and estimate pace.
          </BulletItem>
          <BulletItem>
            <Bold>We do NOT track your location in the background</Bold> outside of an active
            outdoor session. Tracking starts when you tap "Start" and stops when you end the
            session.
          </BulletItem>
          <BulletItem>
            Low-accuracy GPS readings (indoor, blocked sky) are filtered out and not stored.
          </BulletItem>

          <SubHeading>Photos (Food Snap Feature)</SubHeading>
          <BulletItem>
            When you use Food Snap, photos you take or upload of meals are stored in your account.
            They are used only to log your meals and generate nutrition feedback for you.
          </BulletItem>
          <BulletItem>
            We do not use your food photos to train any model, and we do not share them with other
            users.
          </BulletItem>

          <SubHeading>Nutrition & Water Logs</SubHeading>
          <BulletItem>
            Daily meal plans, food snaps, calorie/macro estimates, and water intake amounts you
            log.
          </BulletItem>

          <SubHeading>Community Activity</SubHeading>
          <BulletItem>
            If you participate in challenges, teams, or buddy connections, your selected display
            name, progress, and any content you choose to share are visible to other members of
            those groups.
          </BulletItem>
          <BulletItem>
            Sensitive onboarding answers (trigger statement, anchor person, success vision, etc.)
            are <Bold>never shared</Bold> with other users.
          </BulletItem>

          <SubHeading>AI Coach Conversations</SubHeading>
          <BulletItem>
            Messages you send to the AI coach, along with relevant context (your progress, recent
            sessions, profile), are sent to our AI provider so the model can generate a response.
          </BulletItem>
          <BulletItem>
            Conversation history is stored on our servers so you can return to it later.
          </BulletItem>

          <SubHeading>Device & Usage Data</SubHeading>
          <BulletItem>
            Device model, operating system, app version, language, time zone, and crash logs.
          </BulletItem>
          <BulletItem>
            Anonymous usage analytics (which screens you visit, which actions you take) to help us
            understand what's working and what needs improvement.
          </BulletItem>

          <SubHeading>Push Notification Tokens</SubHeading>
          <BulletItem>
            If you allow notifications, we store the push token issued by your device so we can
            send you reminders and coach messages. You can revoke this anytime.
          </BulletItem>

          <SubHeading>Subscription Status</SubHeading>
          <BulletItem>
            Whether you are a free or Pro user, when your subscription renews, and your purchase
            history (handled via our payment provider, not stored as card numbers).
          </BulletItem>
        </Section>

        <Section title="2. How We Use Your Data">
          <BulletItem>To create your personalized AI coaching plan and feedback.</BulletItem>
          <BulletItem>
            To show you accurate progress: route maps, distance, level, streaks, milestones.
          </BulletItem>
          <BulletItem>To sync your data securely across your devices.</BulletItem>
          <BulletItem>To process Pro subscription payments and entitlement.</BulletItem>
          <BulletItem>
            To send notifications you've opted into (motivational reminders, session prompts,
            coach check-ins).
          </BulletItem>
          <BulletItem>
            To diagnose crashes, fix bugs, monitor performance, and improve the app.
          </BulletItem>
          <BulletItem>
            To analyze aggregated, anonymized trends so we can decide what features to build next.
          </BulletItem>
          <BulletItem>To comply with legal obligations and protect users from abuse.</BulletItem>
        </Section>

        <Section title="3. AI Coach & Third-Party AI Provider">
          <Paragraph>
            MarchBuddy uses a third-party large language model provider to power the AI coach.
            When you interact with the coach, the model receives:
          </Paragraph>
          <BulletItem>Your message text.</BulletItem>
          <BulletItem>
            Limited context from your account (current level, recent session signals, relevant
            profile fields) so it can generate a useful reply.
          </BulletItem>
          <Paragraph>
            <Bold>Important:</Bold> our AI provider has agreed contractually that:
          </Paragraph>
          <BulletItem>Your AI conversations are not used to train external models.</BulletItem>
          <BulletItem>Your data is not shared with other customers.</BulletItem>
          <BulletItem>Data is encrypted in transit.</BulletItem>
        </Section>

        <Section title="4. Subscriptions & Payments">
          <Paragraph>
            Pro subscriptions are processed by Google Play Billing or the Apple App Store.{' '}
            <Bold>We never see, store, or process your credit card details.</Bold>
          </Paragraph>
          <Paragraph>
            Subscription state (free vs. Pro, renewal date) is verified through our payment
            partner's secure webhooks and is stored on our servers so your Pro status persists
            across devices.
          </Paragraph>
        </Section>

        <Section title="5. Third-Party Services We Rely On">
          <Paragraph>
            To run MarchBuddy, we use a small set of trusted infrastructure providers. Each one
            handles a specific role:
          </Paragraph>
          <BulletItem>
            <Bold>Supabase</Bold> — secure database, authentication, and file storage for your
            account data and food snap photos.
          </BulletItem>
          <BulletItem>
            <Bold>RevenueCat</Bold> — subscription management, receipt validation, and Pro
            entitlement tracking.
          </BulletItem>
          <BulletItem>
            <Bold>Google Play Billing / Apple App Store</Bold> — payment processing.
          </BulletItem>
          <BulletItem>
            <Bold>PostHog</Bold> — privacy-respecting product analytics. We do not share personal
            identifiers with PostHog.
          </BulletItem>
          <BulletItem>
            <Bold>Anthropic</Bold> — AI coach response generation (see Section 3 for details).
          </BulletItem>
          <BulletItem>
            <Bold>Expo / Apple Push / Google FCM</Bold> — delivery of push notifications you've
            opted into.
          </BulletItem>
          <Paragraph>
            We do not sell your personal information to anyone, ever.
          </Paragraph>
        </Section>

        <Section title="6. How Long We Keep Your Data">
          <Paragraph>
            We retain your data only as long as your account is active. When you delete your
            account from Settings → Delete Account:
          </Paragraph>
          <BulletItem>Your profile, workout history, AI chat history, scheduled sessions, food snaps, water logs, and subscription record are permanently deleted from our servers.</BulletItem>
          <BulletItem>Push notification tokens and on-device caches are cleared.</BulletItem>
          <BulletItem>
            Aggregated, anonymized analytics that cannot be linked back to you may be retained to
            help us improve the product.
          </BulletItem>
          <Paragraph>
            Account deletion is final and cannot be undone. If you change your mind, you'll need
            to create a new account and start fresh.
          </Paragraph>
        </Section>

        <Section title="7. How We Protect Your Data">
          <BulletItem>All network traffic between the app and our servers is encrypted in transit (HTTPS / TLS).</BulletItem>
          <BulletItem>Account data is protected by row-level security so users can only access their own records.</BulletItem>
          <BulletItem>Sensitive server-side credentials (AI keys, database service roles) are never embedded in the mobile app.</BulletItem>
          <BulletItem>Authentication uses industry-standard token-based sessions with automatic expiry.</BulletItem>
          <Paragraph>
            No system is perfectly secure, but we follow accepted best practices and respond
            quickly to any vulnerability reports.
          </Paragraph>
        </Section>

        <Section title="8. Your Choices & Controls">
          <BulletItem>
            <Bold>Notifications:</Bold> Settings → Notifications. Turn each category on or off
            independently. You can also disable notifications entirely from your device settings.
          </BulletItem>
          <BulletItem>
            <Bold>Quiet hours:</Bold> set hours during which notifications are silenced.
          </BulletItem>
          <BulletItem>
            <Bold>Location:</Bold> revoke location permission anytime via device settings. Outdoor
            route maps will stop working, but the app continues to function (indoor mode).
          </BulletItem>
          <BulletItem>
            <Bold>Camera:</Bold> revoke camera permission anytime — food snap will require manual
            log instead.
          </BulletItem>
          <BulletItem>
            <Bold>Reset Onboarding:</Bold> Settings → Danger Zone. Wipes your onboarding answers
            and takes you back to the welcome screen.
          </BulletItem>
          <BulletItem>
            <Bold>Clear All Data:</Bold> Settings → Danger Zone. Permanently deletes locally
            cached workout, nutrition, and progress data.
          </BulletItem>
          <BulletItem>
            <Bold>Delete Account:</Bold> Settings → Delete Account. Permanent deletion of your
            MarchBuddy account and all server-side data.
          </BulletItem>
        </Section>

        <Section title="9. Your Privacy Rights">
          <Paragraph>
            Depending on where you live, you may have additional rights under your local privacy
            laws (such as GDPR in Europe or CCPA/CPRA in California), including:
          </Paragraph>
          <BulletItem>
            <Bold>Right to access</Bold> — request a copy of the data we hold about you.
          </BulletItem>
          <BulletItem>
            <Bold>Right to correction</Bold> — ask us to fix inaccurate data.
          </BulletItem>
          <BulletItem>
            <Bold>Right to deletion</Bold> — request full deletion of your account (available
            in-app under Settings → Delete Account).
          </BulletItem>
          <BulletItem>
            <Bold>Right to portability</Bold> — request a machine-readable export of your data.
          </BulletItem>
          <BulletItem>
            <Bold>Right to object</Bold> — ask us to stop certain types of processing.
          </BulletItem>
          <Paragraph>
            To exercise any of these rights, email us at <Bold>support@marchbuddy.com</Bold>. We
            will respond within a reasonable time and will not discriminate against you for
            exercising your rights.
          </Paragraph>
        </Section>

        <Section title="10. International Data Transfers">
          <Paragraph>
            MarchBuddy operates globally. Your data may be stored or processed in servers located
            in countries other than your own. When we transfer data internationally, we use
            providers that follow recognized data-protection frameworks and contractual
            safeguards.
          </Paragraph>
        </Section>

        <Section title="11. Children's Privacy">
          <Paragraph>
            MarchBuddy is not intended for children under 13 (or the equivalent minimum age in
            your country). We do not knowingly collect personal information from children. If you
            believe a child has provided us with personal data, please contact us and we will
            promptly delete it.
          </Paragraph>
        </Section>

        <Section title="12. Changes to This Policy">
          <Paragraph>
            We may update this Privacy Policy from time to time as the app evolves or as the law
            changes. When we do, we'll update the "Last updated" date above. Material changes
            will be communicated through an in-app notice or email before they take effect.
          </Paragraph>
        </Section>

        <Section title="13. Contact Us">
          <Paragraph>
            If you have any questions, concerns, or requests about your privacy or this policy,
            reach out anytime at <Bold>support@marchbuddy.com</Bold>. We read every message and
            will respond as quickly as we can.
          </Paragraph>
        </Section>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <Text style={styles.subHeading}>{children}</Text>;
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return <Text style={styles.paragraph}>{children}</Text>;
}

function Bold({ children }: { children: React.ReactNode }) {
  return <Text style={styles.bold}>{children}</Text>;
}

function BulletItem({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
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
  scroll: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 20,
  },
  intro: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    letterSpacing: 0.2,
  },
  meta: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 10,
    letterSpacing: 0.3,
  },
  section: {
    marginTop: 28,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 17,
    color: colors.textPrimary,
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  subHeading: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.primary,
    marginTop: 12,
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  paragraph: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
    marginBottom: 10,
    letterSpacing: 0.15,
  },
  bold: {
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    paddingRight: 4,
  },
  bulletDot: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.primary,
    marginRight: 10,
    lineHeight: 21,
  },
  bulletText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
    flex: 1,
    letterSpacing: 0.15,
  },
  bottomSpacer: {
    height: 40,
  },
});
