import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from '../../navigation/CommunityNavigator';
import { useAuthStore } from '../../store/authStore';
import { useRunProgressStore } from '../../store/runProgressStore';
import { colors, fonts, spacing } from '../../theme';

type Props = NativeStackScreenProps<CommunityStackParamList, 'CommunityHome'>;

export default function CommunityScreen({ navigation }: Props) {
  const { session, isGuest } = useAuthStore();
  const progress = useRunProgressStore((s) => s.progress);

  const isAuthenticated = !!session && !isGuest;

  if (!isAuthenticated) {
    return <GuestGate />;
  }

  return <CommunityHub level={progress?.currentLevel ?? 1} navigation={navigation} />;
}

// ─── Guest gate ───────────────────────────────────────────────────────────────

function GuestGate() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.gateWrapper}>
        <View style={styles.gateIconRing}>
          <Ionicons name="people" size={36} color={colors.primary} />
        </View>

        <Text style={styles.gateTitle}>Join the Community</Text>
        <Text style={styles.gateSub}>
          Bench March your friends, form a team, and challenge other squads —
          all in real life.
        </Text>

        <View style={styles.featureList}>
          <FeatureRow icon="eye-outline" label="Bench March any Level 2+ member" />
          <FeatureRow icon="people-outline" label="Buddy up with runners at your level" />
          <FeatureRow icon="shield-outline" label="Form a team once you reach Level 5" />
          <FeatureRow icon="flash-outline" label="Challenge rival teams. Outdoor only." />
        </View>

        <Text style={styles.migrationNote}>
          Your streak and sessions come with you.
        </Text>

        <Pressable
          style={({ pressed }) => [styles.signUpBtn, pressed && { opacity: 0.85 }]}
          onPress={() => {
            // Navigation to auth will be wired in Phase 2
          }}
        >
          <Text style={styles.signUpBtnText}>Create Free Account</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function FeatureRow({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.featureRow}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={styles.featureRowText}>{label}</Text>
    </View>
  );
}

// ─── Community hub (authenticated) ───────────────────────────────────────────

function CommunityHub({
  level,
  navigation,
}: {
  level: number;
  navigation: Props['navigation'];
}) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.hubContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.hubTitle}>COMMUNITY</Text>

        {level < 2 && (
          <View style={styles.levelGateCard}>
            <Ionicons name="lock-closed" size={18} color={colors.textSecondary} />
            <Text style={styles.levelGateText}>
              Reach Level 2 to unlock Bench March, Buddies, and Challenges.
              Keep showing up.
            </Text>
          </View>
        )}

        <SectionCard
          icon="eye-outline"
          title="Bench March"
          subtitle="Follow runners and get inspired by their progress"
          locked={level < 2}
          onPress={() => navigation.navigate('Discover')}
        />

        <SectionCard
          icon="people-outline"
          title="Buddies"
          subtitle="Connect with runners at your level for 1v1 challenges"
          locked={level < 2}
          onPress={() => navigation.navigate('Buddies')}
        />

        <SectionCard
          icon="shield-outline"
          title="My Team"
          subtitle={level >= 5 ? 'Create or manage your squad' : `Unlocks at Level 5 — you're Level ${level}`}
          locked={level < 5}
          onPress={() => navigation.navigate('MyTeam')}
        />

        <SectionCard
          icon="flash-outline"
          title="Challenges"
          subtitle="Team vs team. Outdoor sessions only. Best of 3 parameters wins."
          locked={level < 5}
          onPress={() => navigation.navigate('Challenges')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionCard({
  icon,
  title,
  subtitle,
  locked,
  comingSoon,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  locked: boolean;
  comingSoon?: boolean;
  onPress?: () => void;
}) {
  const disabled = locked || comingSoon || !onPress;
  return (
    <Pressable
      style={({ pressed }) => [
        styles.sectionCard,
        locked && styles.sectionCardLocked,
        pressed && !disabled && { opacity: 0.8 },
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={[styles.sectionIconRing, locked && styles.sectionIconRingLocked]}>
        <Ionicons
          name={locked ? 'lock-closed-outline' : icon}
          size={20}
          color={locked ? colors.textSecondary : colors.primary}
        />
      </View>

      <View style={styles.sectionCardBody}>
        <View style={styles.sectionCardHeader}>
          <Text style={[styles.sectionCardTitle, locked && styles.textDimmed]}>{title}</Text>
          {comingSoon && !locked && (
            <View style={styles.comingSoonPill}>
              <Text style={styles.comingSoonText}>SOON</Text>
            </View>
          )}
        </View>
        <Text style={[styles.sectionCardSub, locked && styles.textDimmed]}>{subtitle}</Text>
      </View>

      {!locked && (
        <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
      )}
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // ── Guest gate
  gateWrapper: {
    flex: 1,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 48,
    alignItems: 'center',
  },
  gateIconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  gateTitle: {
    fontFamily: fonts.bold,
    fontSize: 26,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  gateSub: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  featureList: {
    width: '100%',
    gap: 14,
    marginBottom: 32,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureRowText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
  },
  migrationNote: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.primary,
    marginBottom: 24,
    textAlign: 'center',
  },
  signUpBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 18,
    paddingHorizontal: 48,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
  },
  signUpBtnText: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: '#fff',
  },

  // ── Community hub
  hubContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 28,
    paddingBottom: 32,
    gap: 12,
  },
  hubTitle: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1.8,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  levelGateCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  levelGateText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 19,
  },

  // ── Section cards
  sectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  sectionCardLocked: {
    opacity: 0.5,
  },
  sectionIconRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionIconRingLocked: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  sectionCardBody: {
    flex: 1,
    gap: 4,
  },
  sectionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionCardTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  sectionCardSub: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  textDimmed: {
    color: colors.textSecondary,
  },
  comingSoonPill: {
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  comingSoonText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.primary,
  },
});
