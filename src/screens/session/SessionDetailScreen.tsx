import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSessionStore } from '../../store/sessionStore';
import { SegmentListItem } from './components/SegmentListItem';
import { formatDurationMinutes } from '../../utils/sessionUtils';
import { colors, fonts, spacing } from '../../theme';
import type { RunStackParamList } from '../../navigation/RunNavigator';

type SessionDetailNavProp = NativeStackNavigationProp<RunStackParamList, 'SessionDetail'>;

interface Props {
  navigation: SessionDetailNavProp;
}

export default function SessionDetailScreen({ navigation }: Props) {
  const { selectedPlan } = useSessionStore();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!selectedPlan && navigation.isFocused()) {
      navigation.goBack();
    }
  }, [selectedPlan, navigation]);

  if (!selectedPlan) return null;

  const difficultyColor = () => {
    switch (selectedPlan.difficulty) {
      case 'easy':        return colors.success;
      case 'moderate':    return colors.primary;
      case 'challenging': return colors.warning;
      case 'hard':        return colors.danger;
      default:            return colors.primary;
    }
  };

  const difficultyLabel =
    selectedPlan.difficulty.charAt(0).toUpperCase() + selectedPlan.difficulty.slice(1);

  const bottomBarHeight = 56 + 16 + 16 + insets.bottom;

  return (
    <View style={styles.container}>
      {/* Fixed header */}
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Session Plan</Text>
          {/* Spacer to center title */}
          <View style={styles.backButton} />
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomBarHeight + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Plan title + meta */}
        <View style={styles.planHeader}>
          <Text style={styles.planTitle}>{selectedPlan.title}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              {formatDurationMinutes(selectedPlan.totalDurationMinutes)}
            </Text>
            <View style={styles.metaDot} />
            <Text style={[styles.metaText, { color: difficultyColor() }]}>
              {difficultyLabel}
            </Text>
            <View style={styles.metaDot} />
            <Text style={styles.metaText}>Level {selectedPlan.level}</Text>
          </View>
          <Text style={styles.summary}>{selectedPlan.summary}</Text>
        </View>

        {/* Segment breakdown */}
        <View style={styles.segmentCard}>
          <Text style={styles.segmentCardLabel}>BREAKDOWN</Text>
          {selectedPlan.segments.map((segment, index) => (
            <SegmentListItem
              key={segment.id}
              segment={segment}
              index={index}
              isLast={index === selectedPlan.segments.length - 1}
            />
          ))}
        </View>

        {/* About this session */}
        {selectedPlan.description ? (
          <View style={styles.descriptionCard}>
            <Text style={styles.descriptionLabel}>ABOUT THIS SESSION</Text>
            <Text style={styles.descriptionText}>{selectedPlan.description}</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Fixed bottom CTA */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={({ pressed }) => [styles.beginButton, pressed && styles.beginButtonPressed]}
          onPress={() => navigation.navigate('ActiveSession')}
        >
          <Text style={styles.beginButtonText}>Begin Session</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerSafe: {
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: spacing.screenPadding,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: spacing.screenPadding,
    gap: 16,
  },
  planHeader: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  planTitle: {
    fontFamily: fonts.titleRegular,
    fontSize: 40,
    color: colors.textPrimary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  metaText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textSecondary,
  },
  metaDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textTertiary,
    marginHorizontal: 8,
  },
  summary: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  segmentCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 18,
    overflow: 'hidden',
  },
  segmentCardLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  descriptionCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 18,
    padding: 20,
  },
  descriptionLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  descriptionText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 16,
  },
  beginButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  beginButtonPressed: {
    opacity: 0.85,
  },
  beginButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: '#fff',
    letterSpacing: 0.3,
  },
});
