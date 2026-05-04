import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  SectionList,
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
  getSuggestedRunners,
  followUser,
  unfollowUser,
  type CommunityProfile,
} from '../../services/communityService';
import { colors, fonts, spacing } from '../../theme';

type Props = NativeStackScreenProps<CommunityStackParamList, 'Discover'>;

export default function DiscoverScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CommunityProfile[]>([]);
  const [following, setFollowing] = useState<CommunityProfile[]>([]);
  const [suggested, setSuggested] = useState<CommunityProfile[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [initialLoading, setInitialLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [loadingFollowId, setLoadingFollowId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Promise.all([getFollowing(), getSuggestedRunners()]).then(([follows, suggestions]) => {
      setFollowing(follows);
      setFollowingIds(new Set(follows.map((p) => p.id)));
      // Exclude already-followed runners from suggestions
      const followedSet = new Set(follows.map((p) => p.id));
      setSuggested(suggestions.filter((p) => !followedSet.has(p.id)));
      setInitialLoading(false);
    });
  }, []);

  const handleQueryChange = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      const found = await searchUsers(text);
      setSearchResults(found);
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
      // Move back to suggestions if still in level range
      setSuggested((prev) => {
        if (prev.find((p) => p.id === profile.id)) return prev;
        return [profile, ...prev];
      });
    } else {
      await followUser(profile.id);
      setFollowingIds((prev) => new Set([...prev, profile.id]));
      setFollowing((prev) => [...prev, profile]);
      setSuggested((prev) => prev.filter((p) => p.id !== profile.id));
    }
    setLoadingFollowId(null);
  }, [followingIds]);

  const isSearchMode = query.trim().length > 0;

  // Build sections for default view
  const sections = [
    ...(following.length > 0
      ? [{ title: `FOLLOWING (${following.length})`, data: following }]
      : []),
    ...(suggested.length > 0
      ? [{ title: 'DISCOVER RUNNERS', data: suggested }]
      : []),
  ];

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

      {initialLoading ? (
        <ActivityIndicator style={{ marginTop: 48 }} color={colors.primary} />
      ) : isSearchMode ? (
        /* ── Search results ── */
        <>
          {isSearching ? (
            <ActivityIndicator style={{ marginTop: 48 }} color={colors.primary} />
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <RunnerCard
                  profile={item}
                  isFollowing={followingIds.has(item.id)}
                  loading={loadingFollowId === item.id}
                  onToggleFollow={() => toggleFollow(item)}
                  onPress={() => navigation.navigate('UserProfile', { userId: item.id })}
                />
              )}
              ListHeaderComponent={
                <Text style={styles.sectionLabel}>SEARCH RESULTS</Text>
              }
              ListEmptyComponent={
                <Text style={styles.emptyText}>No runners found for "{query}"</Text>
              }
              contentContainerStyle={
                searchResults.length === 0 ? styles.emptyContainer : styles.listContent
              }
              showsVerticalScrollIndicator={false}
            />
          )}
        </>
      ) : (
        /* ── Default: following + suggested ── */
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section: { title } }) => (
            <Text style={styles.sectionLabel}>{title}</Text>
          )}
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
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={36} color={colors.textSecondary} />
              <Text style={styles.emptyTitle}>No runners yet</Text>
              <Text style={styles.emptyText}>
                Runners appear here once they reach Level 2.{'\n'}Try searching by name above.
              </Text>
            </View>
          }
          contentContainerStyle={
            sections.length === 0 ? styles.emptyContainerCentered : styles.listContent
          }
          stickySectionHeadersEnabled={false}
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
      <View style={styles.avatar}>
        <Text style={styles.avatarLetter}>
          {profile.name.charAt(0).toUpperCase()}
        </Text>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardNameRow}>
          <Text style={styles.cardName} numberOfLines={1}>{profile.name}</Text>
          <View style={styles.levelBadge}>
            <Text style={styles.levelBadgeText}>LVL {profile.level}</Text>
          </View>
        </View>
        <View style={styles.cardMeta}>
          <MetaPill icon="flame-outline" label={`${profile.currentStreak}d streak`} />
          <MetaPill icon="walk-outline" label={`${profile.totalSessions} sessions`} />
          {profile.totalDistanceKm > 0 && (
            <MetaPill icon="map-outline" label={`${profile.totalDistanceKm.toFixed(1)}km`} />
          )}
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.followBtn,
          isFollowing && styles.followBtnActive,
          pressed && { opacity: 0.75 },
        ]}
        onPress={onToggleFollow}
        disabled={loading}
        hitSlop={8}
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
    marginBottom: 4,
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
    marginTop: 20,
    marginBottom: 10,
  },
  listContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 32,
    gap: 10,
  },
  emptyContainer: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 48,
    alignItems: 'center',
    gap: 10,
  },
  emptyContainerCentered: {
    flex: 1,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 80,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 17,
    color: colors.textPrimary,
    marginTop: 8,
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Card
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
    flexShrink: 0,
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
  cardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardName: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  levelBadge: {
    backgroundColor: colors.primaryDim,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexShrink: 0,
  },
  levelBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.primary,
  },
  cardMeta: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
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
    minWidth: 82,
    alignItems: 'center',
    flexShrink: 0,
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
