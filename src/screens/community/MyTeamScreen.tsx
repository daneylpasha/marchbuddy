import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { showAppDialog } from '../../services/appDialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from '../../navigation/CommunityNavigator';
import {
  getMyTeam,
  createTeam,
  removeMember,
  type Team,
  type TeamMember,
} from '../../services/teamService';
import { searchUsers } from '../../services/communityService';
import { inviteMember } from '../../services/teamService';
import { useRunProgressStore } from '../../store/runProgressStore';
import { colors, fonts, spacing } from '../../theme';
import ConfirmDialog from '../../components/common/ConfirmDialog';

type Props = NativeStackScreenProps<CommunityStackParamList, 'MyTeam'>;

export default function MyTeamScreen({ navigation }: Props) {
  const myLevel = useRunProgressStore((s) => s.progress?.currentLevel ?? 1);
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [createError, setCreateError] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<TeamMember | null>(null);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(async () => {
    const t = await getMyTeam();
    setTeam(t);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (teamName.trim().length < 3) {
      setCreateError('Team name must be at least 3 characters.');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      const t = await createTeam(teamName.trim());
      setTeam(t);
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create team.');
    } finally {
      setCreating(false);
    }
  };

  const handleRemove = (member: TeamMember) => {
    setPendingRemove(member);
  };

  const confirmRemove = async () => {
    if (!team || !pendingRemove) return;
    setRemoving(true);
    try {
      await removeMember(team.id, pendingRemove.userId);
      setPendingRemove(null);
      await load();
    } finally {
      setRemoving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header onBack={() => navigation.goBack()} title="My Team" />
        <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (myLevel < 5) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header onBack={() => navigation.goBack()} title="My Team" />
        <View style={styles.gateWrapper}>
          <Ionicons name="lock-closed" size={36} color={colors.textSecondary} />
          <Text style={styles.gateTitle}>Unlock at Level 5</Text>
          <Text style={styles.gateSub}>
            You're Level {myLevel}. Keep showing up to unlock team formation.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!team) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header onBack={() => navigation.goBack()} title="Create Team" />
        <View style={styles.createWrapper}>
          <View style={styles.iconRing}>
            <Ionicons name="shield-outline" size={32} color={colors.primary} />
          </View>
          <Text style={styles.createTitle}>Form Your Squad</Text>
          <Text style={styles.createSub}>
            Pick a unique name. You'll be captain. Invite Level 2+ members.
          </Text>
          <TextInput
            style={[styles.input, createError ? styles.inputError : null]}
            placeholder="Team name (min 3 chars)"
            placeholderTextColor={colors.textSecondary}
            value={teamName}
            onChangeText={(t) => {
              setTeamName(t);
              setCreateError('');
            }}
            maxLength={32}
            autoCapitalize="words"
          />
          {!!createError && <Text style={styles.errorText}>{createError}</Text>}
          <Pressable
            style={({ pressed }) => [styles.createBtn, pressed && { opacity: 0.85 }]}
            onPress={handleCreate}
            disabled={creating}
          >
            {creating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.createBtnText}>Create Team</Text>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header onBack={() => navigation.goBack()} title={team.name} />

      <FlatList
        data={team.members}
        keyExtractor={(m) => m.userId}
        renderItem={({ item }) => (
          <MemberRow
            member={item}
            isCaptain={item.isCapt}
            canRemove={!item.isCapt && team.members.length > 1}
            onRemove={() => handleRemove(item)}
            onPress={() => navigation.navigate('UserProfile', { userId: item.userId })}
          />
        )}
        ListHeaderComponent={
          <View style={styles.teamHeader}>
            <View style={styles.teamPointsCard}>
              <Ionicons name="trophy-outline" size={20} color="#F59E0B" />
              <Text style={styles.teamPointsText}>{team.winPoints} win points</Text>
            </View>
            <Text style={styles.sectionLabel}>MEMBERS ({team.members.length}/3)</Text>
          </View>
        }
        ListFooterComponent={
          team.members.length < 3 ? (
            <View style={styles.inviteFooter}>
              <Pressable
                style={({ pressed }) => [styles.inviteBtn, pressed && { opacity: 0.85 }]}
                onPress={() => setShowInvite(true)}
              >
                <Ionicons name="person-add-outline" size={18} color="#fff" />
                <Text style={styles.inviteBtnText}>Invite Member</Text>
              </Pressable>
            </View>
          ) : null
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {showInvite && (
        <InviteOverlay
          teamId={team.id}
          existingMemberIds={team.members.map((m) => m.userId)}
          onClose={() => {
            setShowInvite(false);
            load();
          }}
        />
      )}

      <ConfirmDialog
        visible={!!pendingRemove}
        icon="person-remove-outline"
        title="Remove member?"
        message={`Remove ${pendingRemove?.profile.name ?? 'this runner'} from your team?`}
        confirmLabel={removing ? 'Removing…' : 'Remove'}
        cancelLabel="Cancel"
        destructive
        onCancel={() => !removing && setPendingRemove(null)}
        onConfirm={confirmRemove}
      />
    </SafeAreaView>
  );
}

// ─── Invite overlay ───────────────────────────────────────────────────────────

function InviteOverlay({
  teamId,
  existingMemberIds,
  onClose,
}: {
  teamId: string;
  existingMemberIds: string[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ id: string; name: string; level: number }[]>([]);
  const [inviting, setInviting] = useState<string | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const found = await searchUsers(query);
      setResults(found.filter((u) => !existingMemberIds.includes(u.id)));
    }, 300);
    return () => clearTimeout(t);
  }, [query, existingMemberIds]);

  const invite = async (userId: string) => {
    setInviting(userId);
    try {
      await inviteMember(teamId, userId);
      onClose();
    } catch (e: unknown) {
      showAppDialog('Error', e instanceof Error ? e.message : 'Failed to invite.');
      setInviting(null);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.overlay}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.overlaySheet}>
        <View style={styles.overlayHeader}>
          <Text style={styles.overlayTitle}>Invite Member</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={22} color={colors.textPrimary} />
          </Pressable>
        </View>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name…"
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={setQuery}
          autoFocus
        />
        {results.map((u) => (
          <View key={u.id} style={styles.resultRow}>
            <View style={styles.resultAvatar}>
              <Text style={styles.resultAvatarLetter}>{u.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.resultName}>{u.name}</Text>
              <Text style={styles.resultLevel}>Level {u.level}</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.inviteSmBtn, pressed && { opacity: 0.8 }]}
              onPress={() => invite(u.id)}
              disabled={inviting === u.id}
            >
              {inviting === u.id ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.inviteSmBtnText}>Invite</Text>
              )}
            </Pressable>
          </View>
        ))}
        {query.trim() && !results.length && <Text style={styles.noResults}>No runners found</Text>}
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Header({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={12}>
        <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={{ width: 24 }} />
    </View>
  );
}

function MemberRow({
  member,
  isCaptain,
  canRemove,
  onRemove,
  onPress,
}: {
  member: TeamMember;
  isCaptain: boolean;
  canRemove: boolean;
  onRemove: () => void;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.memberRow, pressed && { opacity: 0.85 }]}
      onPress={onPress}
    >
      <View style={styles.memberAvatar}>
        <Text style={styles.memberAvatarLetter}>{member.profile.name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.memberBody}>
        <View style={styles.memberNameRow}>
          <Text style={styles.memberName} numberOfLines={1}>
            {member.profile.name}
          </Text>
          {isCaptain && (
            <View style={styles.captBadge}>
              <Text style={styles.captBadgeText}>CAPT</Text>
            </View>
          )}
        </View>
        <Text style={styles.memberMeta}>
          Lvl {member.profile.level} · {member.profile.currentStreak}d streak
        </Text>
      </View>
      <View style={styles.memberRight}>
        {member.winPointsEarned > 0 && (
          <Text style={styles.memberWinPts}>+{member.winPointsEarned} WP</Text>
        )}
        {canRemove && (
          <Pressable onPress={onRemove} hitSlop={8} style={{ marginLeft: 8 }}>
            <Ionicons name="remove-circle-outline" size={20} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 14,
  },
  headerTitle: { fontFamily: fonts.semiBold, fontSize: 17, color: colors.textPrimary },
  listContent: { paddingBottom: 40 },
  teamHeader: {
    paddingHorizontal: spacing.screenPadding,
    gap: 16,
    marginBottom: 12,
  },
  teamPointsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
  },
  teamPointsText: { fontFamily: fonts.semiBold, fontSize: 15, color: '#F59E0B' },
  sectionLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.textSecondary,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarLetter: { fontFamily: fonts.bold, fontSize: 18, color: colors.primary },
  memberBody: { flex: 1, gap: 3 },
  memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  memberName: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.textPrimary },
  memberMeta: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  captBadge: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  captBadgeText: { fontFamily: fonts.bold, fontSize: 9, letterSpacing: 0.8, color: '#F59E0B' },
  memberRight: { flexDirection: 'row', alignItems: 'center' },
  memberWinPts: { fontFamily: fonts.medium, fontSize: 12, color: '#F59E0B' },
  inviteFooter: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 20,
  },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
  },
  inviteBtnText: { fontFamily: fonts.semiBold, fontSize: 16, color: '#fff' },

  // Create team
  createWrapper: {
    flex: 1,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 40,
    alignItems: 'center',
    gap: 16,
  },
  iconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  createTitle: { fontFamily: fonts.bold, fontSize: 24, color: colors.textPrimary },
  createSub: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  input: {
    width: '100%',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.textPrimary,
  },
  inputError: { borderColor: '#EF4444' },
  errorText: { fontFamily: fonts.regular, fontSize: 13, color: '#EF4444', alignSelf: 'flex-start' },
  createBtn: {
    width: '100%',
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  createBtnText: { fontFamily: fonts.semiBold, fontSize: 16, color: '#fff' },

  // Gate
  gateWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.screenPadding,
    gap: 16,
  },
  gateTitle: { fontFamily: fonts.bold, fontSize: 22, color: colors.textPrimary },
  gateSub: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },

  // Invite overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  overlaySheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 40,
    paddingTop: 20,
    maxHeight: '75%',
    gap: 12,
  },
  overlayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  overlayTitle: { fontFamily: fonts.semiBold, fontSize: 17, color: colors.textPrimary },
  searchInput: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textPrimary,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  resultAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultAvatarLetter: { fontFamily: fonts.bold, fontSize: 16, color: colors.primary },
  resultName: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.textPrimary },
  resultLevel: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  inviteSmBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  inviteSmBtnText: { fontFamily: fonts.semiBold, fontSize: 13, color: '#fff' },
  noResults: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 16,
  },
});
