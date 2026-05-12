import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from '../../navigation/CommunityNavigator';
import {
  searchTeams,
  getFavoriteTeams,
  favoriteTeam,
  unfavoriteTeam,
  type TeamSummary,
} from '../../services/teamService';
import { getMyTeamId, sendChallenge } from '../../services/challengeService';
import { colors, fonts, spacing } from '../../theme';

type Props = NativeStackScreenProps<CommunityStackParamList, 'TeamSearch'>;

export default function TeamSearchScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [results, setResults] = useState<TeamSummary[]>([]);
  const [favorites, setFavorites] = useState<TeamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [challenging, setChallengingId] = useState<string | null>(null);
  const [favToggling, setFavToggling] = useState<string | null>(null);

  const loadInitial = useCallback(async () => {
    const tid = await getMyTeamId();
    setMyTeamId(tid);
    const favs = await getFavoriteTeams(tid ?? undefined);
    setFavorites(favs);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const found = await searchTeams(query, myTeamId ?? undefined);
      setResults(found);
    }, 350);
    return () => clearTimeout(t);
  }, [query, myTeamId]);

  const handleChallenge = (team: TeamSummary) => {
    Alert.alert('Send Challenge', `Challenge ${team.name} to a 7-day outdoor session battle?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send',
        onPress: async () => {
          setChallengingId(team.id);
          try {
            await sendChallenge(team.id);
            Alert.alert('Challenge Sent!', `${team.name} has been invited to compete.`);
          } catch (e: unknown) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Failed to send challenge.');
          } finally {
            setChallengingId(null);
          }
        },
      },
    ]);
  };

  const toggleFav = async (team: TeamSummary) => {
    setFavToggling(team.id);
    if (team.isFavorited) {
      await unfavoriteTeam(team.id);
      setFavorites((prev) => prev.filter((t) => t.id !== team.id));
      setResults((prev) => prev.map((t) => (t.id === team.id ? { ...t, isFavorited: false } : t)));
    } else {
      await favoriteTeam(team.id);
      setFavorites((prev) => [...prev, { ...team, isFavorited: true }]);
      setResults((prev) => prev.map((t) => (t.id === team.id ? { ...t, isFavorited: true } : t)));
    }
    setFavToggling(null);
  };

  const showFavorites = !query.trim() && favorites.length > 0;
  const showResults = !!query.trim();

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header onBack={() => navigation.goBack()} />
        <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!myTeamId) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header onBack={() => navigation.goBack()} />
        <View style={styles.gateWrapper}>
          <Ionicons name="shield-outline" size={36} color={colors.textSecondary} />
          <Text style={styles.gateTitle}>You need a team first</Text>
          <Text style={styles.gateSub}>Form your squad before searching for opponents.</Text>
          <Pressable
            style={({ pressed }) => [styles.goBtn, pressed && { opacity: 0.85 }]}
            onPress={() => navigation.navigate('MyTeam')}
          >
            <Text style={styles.goBtnText}>Go to My Team</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header onBack={() => navigation.goBack()} />

      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color={colors.textSecondary} style={{ marginLeft: 12 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search teams by name…"
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
        />
        {!!query && (
          <Pressable onPress={() => setQuery('')} hitSlop={8} style={{ marginRight: 12 }}>
            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>

      <FlatList
        data={showResults ? results : showFavorites ? favorites : []}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => (
          <TeamCard
            team={item}
            isChallengeing={challenging === item.id}
            isFavToggling={favToggling === item.id}
            onChallenge={() => handleChallenge(item)}
            onFav={() => toggleFav(item)}
          />
        )}
        ListHeaderComponent={
          showFavorites && !showResults ? (
            <Text style={styles.sectionLabel}>FAVOURITES</Text>
          ) : showResults && !results.length ? (
            <Text style={styles.noResults}>No teams found for "{query}"</Text>
          ) : null
        }
        ListEmptyComponent={
          !showResults && !showFavorites ? (
            <View style={styles.emptyWrapper}>
              <Ionicons name="search-outline" size={36} color={colors.textSecondary} />
              <Text style={styles.emptyText}>Search to find rival teams</Text>
            </View>
          ) : null
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={12}>
        <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
      </Pressable>
      <Text style={styles.headerTitle}>Find Opponents</Text>
      <View style={{ width: 24 }} />
    </View>
  );
}

function TeamCard({
  team,
  isChallengeing,
  isFavToggling,
  onChallenge,
  onFav,
}: {
  team: TeamSummary;
  isChallengeing: boolean;
  isFavToggling: boolean;
  onChallenge: () => void;
  onFav: () => void;
}) {
  return (
    <View style={styles.teamCard}>
      <View style={styles.teamCardLeft}>
        <View style={styles.teamShield}>
          <Ionicons name="shield" size={20} color={colors.primary} />
        </View>
        <View style={styles.teamCardBody}>
          <Text style={styles.teamCardName} numberOfLines={1}>
            {team.name}
          </Text>
          <Text style={styles.teamCardMeta}>
            {team.memberCount} member{team.memberCount !== 1 ? 's' : ''} · Capt Lvl{' '}
            {team.captainLevel} · {team.winPoints} WP
          </Text>
        </View>
      </View>
      <View style={styles.teamCardActions}>
        <Pressable
          style={({ pressed }) => [styles.favBtn, pressed && { opacity: 0.7 }]}
          onPress={onFav}
          disabled={isFavToggling}
        >
          {isFavToggling ? (
            <ActivityIndicator size="small" color={colors.textSecondary} />
          ) : (
            <Ionicons
              name={team.isFavorited ? 'bookmark' : 'bookmark-outline'}
              size={20}
              color={team.isFavorited ? colors.primary : colors.textSecondary}
            />
          )}
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.challengeBtn, pressed && { opacity: 0.85 }]}
          onPress={onChallenge}
          disabled={isChallengeing}
        >
          {isChallengeing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.challengeBtnText}>Challenge</Text>
          )}
        </Pressable>
      </View>
    </View>
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.screenPadding,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 12,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textPrimary,
  },
  listContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 40,
    gap: 10,
  },
  sectionLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  noResults: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 24,
  },
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  teamCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  teamShield: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamCardBody: { flex: 1, gap: 3 },
  teamCardName: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.textPrimary },
  teamCardMeta: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  teamCardActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  favBtn: { padding: 6 },
  challengeBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  challengeBtnText: { fontFamily: fonts.semiBold, fontSize: 13, color: '#fff' },
  emptyWrapper: {
    alignItems: 'center',
    paddingTop: 64,
    gap: 12,
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
  },
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
  goBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    marginTop: 8,
  },
  goBtnText: { fontFamily: fonts.semiBold, fontSize: 15, color: '#fff' },
});
