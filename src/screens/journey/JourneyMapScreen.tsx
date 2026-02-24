import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { useRunProgressStore } from '../../store/runProgressStore';
import { LEVEL_DEFINITIONS } from '../../constants/sessionTemplates';
import { JourneyPath } from './components/JourneyPath';
import { LevelDetailCard } from './components/LevelDetailCard';
import { colors, fonts, spacing } from '../../theme';
import type { ProgressStackParamList } from '../../navigation/ProgressNavigator';

type NavProp = NativeStackNavigationProp<ProgressStackParamList, 'JourneyMap'>;

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Estimated pixel height per level slot in the JourneyPath
const NODE_HEIGHT_ESTIMATE = 96;
const FINISH_SECTION_HEIGHT = 160;

export default function JourneyMapScreen() {
  const navigation = useNavigation<NavProp>();
  const scrollViewRef = useRef<ScrollView>(null);

  const progress = useRunProgressStore((s) => s.progress);
  const currentLevel = progress?.currentLevel ?? 1;
  const sessionsAtLevel = progress?.sessionsAtCurrentLevel ?? 0;

  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);

  // Auto-scroll to current level on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (scrollViewRef.current) {
        // Number of locked/future levels above current (in the reversed display, higher levels are at top)
        const levelsAboveCurrent = 16 - currentLevel;
        const estimatedNodeTop =
          FINISH_SECTION_HEIGHT + levelsAboveCurrent * NODE_HEIGHT_ESTIMATE;
        const scrollY = Math.max(0, estimatedNodeTop - SCREEN_HEIGHT / 3);
        scrollViewRef.current.scrollTo({ y: scrollY, animated: true });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [currentLevel]);

  const handleLevelPress = (level: number) => {
    // Only show detail for completed or current levels
    if (level <= currentLevel) {
      setSelectedLevel((prev) => (prev === level ? null : level));
    }
  };

  const handleContinue = () => {
    // Navigate to the Run (Today) tab
    const parentNav = navigation.getParent();
    if (parentNav) {
      parentNav.navigate('Run' as never);
    } else {
      navigation.goBack();
    }
  };

  const selectedLevelDef = selectedLevel
    ? LEVEL_DEFINITIONS.find((l) => l.level === selectedLevel)
    : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Journey</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Journey ScrollView */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Finish line / trophy */}
        <View style={styles.finishLine}>
          <View style={styles.trophyCircle}>
            <Ionicons name="trophy" size={36} color={colors.warning} />
          </View>
          <Text style={styles.finishTitle}>5K RUNNER</Text>
          <Text style={styles.finishSubtitle}>The finish line</Text>
        </View>

        {/* Level nodes path */}
        <JourneyPath
          levels={LEVEL_DEFINITIONS}
          currentLevel={currentLevel}
          sessionsAtCurrentLevel={sessionsAtLevel}
          selectedLevel={selectedLevel}
          onLevelPress={handleLevelPress}
        />

        {/* Start point */}
        <View style={styles.startPoint}>
          <View style={styles.startDot} />
          <Text style={styles.startText}>YOUR JOURNEY BEGINS</Text>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Fixed bottom CTA */}
      <View style={styles.bottomCta}>
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={handleContinue}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaText}>Continue Level {currentLevel}</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Level detail modal */}
      {selectedLevelDef && (
        <LevelDetailCard
          level={selectedLevelDef}
          isCurrentLevel={selectedLevel === currentLevel}
          isCompleted={selectedLevel !== null && selectedLevel < currentLevel}
          sessionsCompleted={
            selectedLevel === currentLevel ? sessionsAtLevel : 3
          }
          onClose={() => setSelectedLevel(null)}
        />
      )}
    </SafeAreaView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 32,
  },

  // Finish line
  finishLine: {
    alignItems: 'center',
    marginBottom: 8,
  },
  trophyCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,152,0,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,152,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  finishTitle: {
    fontFamily: fonts.titleRegular,
    fontSize: 26,
    color: colors.warning,
    letterSpacing: 2,
    marginBottom: 4,
  },
  finishSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textTertiary,
    letterSpacing: 0.3,
  },

  // Start point
  startPoint: {
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 20,
  },
  startDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.primary,
    marginBottom: 10,
    marginLeft: 18 - 7, // align with connecting line center
  },
  startText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  bottomPadding: {
    height: 120,
  },

  // Bottom CTA
  bottomCta: {
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 16,
    paddingBottom: 28,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  ctaButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  ctaText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
