import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from '../../navigation/CommunityNavigator';
import {
  searchUsers,
  getFollowing,
  followUser,
  unfollowUser,
  type CommunityProfile,
} from '../../services/communityService';
import { colors, fonts, spacing } from '../../theme';

type Props = NativeStackScreenProps<CommunityStackParamList, 'Discover'>;

export default function DiscoverScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CommunityProfile[]>([]);
  const [following, setFollowing] = useState<CommunityProfile[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [isSearching, setIsSearching] = useState(false);
  const [loadingFollowId, setLoadingFollowId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getFollowing().then((list) => {
      setFollowing(list);
      setFollowingIds(new Set(list.map((p) => p.id)));
    });
  }, []);

  const handleQueryChange = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      const found = await searchUsers(text);
      setResults(found);
      setIsSearching(false);
    }, 350);
  }, []);

  const toggleFollow = useCallback(async (profile: CommunityProfile) => {
    setLoadingFollowId(profile.id);
    const alreadyFollowing = followingIds.has(profile.id);
    if (alreadyFollowing) {
      await unfollowUser(profile.id);
      setFollowingIds((prev) => { const s = new Set(prev); s.delete(profile.id); return s; });
      setFollowing((prev) => prev.filter((p) => p.id !== profile.id));
    } else {
      await followUser(profile.id);
      setFollowingIds((prev) => new Set([...prev, profile.id]));
      setFollowing((prev) => [...prev, profile]);
    }
    setLoadingFollowId(null);
  }, [followingIds]);

  const isSearchMode = query.trim().length > 0;
  const listData = isSearchMode ? results : following;
  const emptyText = isSearchMode
    ? 'No runners found. Try a different name.'
    : "You haven't Bench Marched anyone yet.\nSearch for runners above to follow them.";

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Bench March</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Search bar */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color={colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search runners by name…"
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={handleQueryChange}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Pressable onPress={() => handleQueryChange('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>

      {!isSearchMode && (
        <Text style={styles.sectionLabel}>
          {following.length > 0
            ? `FOLLOWING (${following.length})`
            : 'FIND RUNNERS TO FOLLOW'}
        </Text>
      )}

      {isSearching ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item) => item.id}
          contentContainerStyle={listData.length === 0 ? styles.emptyContainer : styles.listContent}
          renderItem={({ item }) => (
            <RunnerCard
              profile={item}
              isFollowing={followingIds.has(item.id)}
              loading={loadingFollowId === item.id}
              onToggleFollow={() => toggleFollow(item)}
              onPress={() => navigation.navigate('UserProfile', { userId: item.id })}
            />
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>{emptyText}</Text>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Runner card ──────────────────────────────────────────────────────────────

function RunnerCard({
  profile,
  isFollowing,
  loading,
  onToggleFollow,
  onPress,
}: {
  profile: CommunityProfile;
  isFollowing: boolean;
  loading: boolean;
  onToggleFollow: () => void;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}
      onPress={onPress}
    >
      {/* Avatar placeholder */}
      <View style={styles.avatar}>
        <Text style={styles.avatarLetter}>
          {profile.name.charAt(0).toUpperCase()}
        </Text>
      </View>

      {/* Info */}
      <View style={styles.cardBody}>
        <Text style={styles.cardName} numberOfLines={1}>{profile.name}</Text>
        <View style={styles.cardMeta}>
          <MetaPill icon="trending-up-outline" label={`Lvl ${profile.level}`} />
          <MetaPill icon="flame-outline" label={`${profile.currentStreak}d streak`} />
        </View>
      </View>

      {/* Follow button */}
      <Pressable
        style={({ pressed }) => [
          styles.followBtn,
          isFollowing && styles.followBtnActive,
          pressed && { opacity: 0.75 },
        ]}
        onPress={onToggleFollow}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color={isFollowing ? colors.textSecondary : '#fff'} />
        ) : (
          <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}>
            {isFollowing ? 'Marching' : 'March'}
          </Text>
        )}
      </Pressable>
    </Pressable>
  );
}

function MetaPill({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.metaPill}>
      <Ionicons name={icon} size={11} color={colors.textSecondary} />
      <Text style={styles.metaPillText}>{label}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 14,
  },
  headerTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 17,
    color: colors.textPrimary,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    marginHorizontal: spacing.screenPadding,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  searchIcon: {
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textPrimary,
    padding: 0,
  },
  sectionLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.textSecondary,
    marginHorizontal: spacing.screenPadding,
    marginTop: 24,
    marginBottom: 12,
  },
  listContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 32,
    gap: 10,
  },
  emptyContainer: {
    flex: 1,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 48,
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.primary,
  },
  cardBody: {
    flex: 1,
    gap: 5,
  },
  cardName: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  cardMeta: {
    flexDirection: 'row',
    gap: 8,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaPillText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  followBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.primary,
    minWidth: 76,
    alignItems: 'center',
  },
  followBtnActive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  followBtnText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: '#fff',
  },
  followBtnTextActive: {
    color: colors.textSecondary,
  },
});
