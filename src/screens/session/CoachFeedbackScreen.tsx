import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, fonts, spacing } from '../../theme';
import { useRunProgressStore } from '../../store/runProgressStore';
import type { RunStackParamList } from '../../navigation/RunNavigator';

type Props = NativeStackScreenProps<RunStackParamList, 'CoachFeedback'>;

function formatDuration(minutes: number): string {
  const m = Math.floor(minutes);
  const s = Math.round((minutes - m) * 60);
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

const SESSIONS_TO_LEVEL_UP = 3;
const MAX_LEVEL = 16;

export default function CoachFeedbackScreen({ navigation, route }: Props) {
  const { coachFeedback, progressUpdate, session, shareAfter } = route.params;
  const { progress } = useRunProgressStore();

  const captureViewRef = useRef<View>(null);
  const [isSharing, setIsSharing] = useState(false);

  // Entrance animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.88)).current;
  const checkScaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 420, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 9, useNativeDriver: true }),
      ]),
      Animated.spring(checkScaleAnim, { toValue: 1, tension: 80, friction: 7, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, scaleAnim, checkScaleAnim]);

  const handleDone = () => {
    navigation.popToTop();
  };

  const handleShare = async () => {
    if (!captureViewRef.current) return;
    setIsSharing(true);
    try {
      const uri = await captureRef(captureViewRef, { format: 'png', quality: 1 });
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Share your session',
        });
      } else {
        Alert.alert('Sharing not available on this device');
      }
    } catch (err) {
      console.error('Share capture error:', err);
      Alert.alert('Error', 'Could not capture the screen.');
    } finally {
      setIsSharing(false);
    }
  };

  const durationStr = formatDuration(session.actualDurationMinutes);
  const distanceStr = session.actualDistanceKm > 0
    ? `${session.actualDistanceKm.toFixed(2)} km`
    : '—';
  const segmentsStr = `${session.completedSegments}/${session.plannedSegments.length}`;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.inner, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          {/* Invisible wrapper that gets captured — excludes the CTA button */}
          <View ref={captureViewRef} collapsable={false} style={styles.captureArea}>

          {/* ── Hero checkmark ── */}
          <View style={styles.heroSection}>
            <Animated.View style={[styles.glowRing, { transform: [{ scale: checkScaleAnim }] }]}>
              <View style={styles.checkCircle}>
                <Ionicons name="checkmark" size={56} color="#fff" />
              </View>
            </Animated.View>
            <Text style={styles.heroTitle}>Session{'\n'}Complete</Text>
            <Text style={styles.heroSubtitle}>{session.planTitle}</Text>
          </View>

          {/* ── Session stats ── */}
          <View style={styles.sessionStatsRow}>
            <View style={styles.sessionStat}>
              <Ionicons name="time-outline" size={18} color={colors.primary} />
              <Text style={styles.sessionStatValue}>{durationStr}</Text>
              <Text style={styles.sessionStatLabel}>Time</Text>
            </View>
            <View style={styles.sessionStatDivider} />
            <View style={styles.sessionStat}>
              <Ionicons name="navigate-outline" size={18} color={colors.primary} />
              <Text style={styles.sessionStatValue}>{distanceStr}</Text>
              <Text style={styles.sessionStatLabel}>Distance</Text>
            </View>
            <View style={styles.sessionStatDivider} />
            <View style={styles.sessionStat}>
              <Ionicons name="layers-outline" size={18} color={colors.primary} />
              <Text style={styles.sessionStatValue}>{segmentsStr}</Text>
              <Text style={styles.sessionStatLabel}>Segments</Text>
            </View>
          </View>

          {/* ── Progress stats ── */}
          <View style={styles.progressRow}>
            <View style={styles.progressCard}>
              <Text style={styles.progressValue}>{progressUpdate.totalSessions}</Text>
              <Text style={styles.progressLabel}>Total{'\n'}Sessions</Text>
            </View>
            <View style={styles.progressCard}>
              <View style={styles.streakValueRow}>
                <Text style={styles.progressValue}>{progressUpdate.currentStreak}</Text>
                <Ionicons name="flame" size={18} color={colors.streak} style={styles.flameIcon} />
              </View>
              <Text style={styles.progressLabel}>Day{'\n'}Streak</Text>
            </View>
            <View style={[styles.progressCard, progressUpdate.leveledUp && styles.progressCardHighlight]}>
              <Text style={[styles.progressValue, progressUpdate.leveledUp && styles.progressValueHighlight]}>
                {progressUpdate.leveledUp ? '↑' : ''}{progressUpdate.newLevel}
              </Text>
              <Text style={[styles.progressLabel, progressUpdate.leveledUp && styles.progressLabelHighlight]}>
                {progressUpdate.leveledUp ? 'Level\nUp!' : 'Current\nLevel'}
              </Text>
            </View>
          </View>

          {/* ── Level progress ── */}
          {!progressUpdate.leveledUp && progressUpdate.newLevel < MAX_LEVEL && (() => {
            const sessionsAtLevel = progress?.sessionsAtCurrentLevel ?? 0;
            const remaining = Math.max(0, SESSIONS_TO_LEVEL_UP - sessionsAtLevel);
            const fillPct = Math.min(sessionsAtLevel / SESSIONS_TO_LEVEL_UP, 1);
            return (
              <View style={styles.levelCard}>
                <View style={styles.levelCardHeader}>
                  <Text style={styles.levelCardTitle}>Level {progressUpdate.newLevel}</Text>
                  <Text style={styles.levelCardNext}>→ Level {progressUpdate.newLevel + 1}</Text>
                </View>

                {/* Progress bar */}
                <View style={styles.levelTrack}>
                  <View style={[styles.levelFill, { width: `${fillPct * 100}%` }]} />
                </View>

                {/* Session dots */}
                <View style={styles.levelDots}>
                  {Array.from({ length: SESSIONS_TO_LEVEL_UP }).map((_, i) => (
                    <View
                      key={i}
                      style={[styles.levelDot, i < sessionsAtLevel && styles.levelDotFilled]}
                    />
                  ))}
                </View>

                <Text style={styles.levelHint}>
                  {remaining === 0
                    ? '🎉 Level up on next session!'
                    : `${remaining} more session${remaining > 1 ? 's' : ''} to reach Level ${progressUpdate.newLevel + 1}`}
                </Text>
              </View>
            );
          })()}

          {/* ── Coach message ── */}
          <View style={styles.coachCard}>
            <View style={styles.coachHeader}>
              <View style={styles.coachAvatar}>
                <Ionicons name="person" size={13} color={colors.primary} />
              </View>
              <Text style={styles.coachLabel}>YOUR COACH</Text>
            </View>
            <Text style={styles.coachMessage}>{coachFeedback}</Text>
          </View>

          </View>{/* end captureArea */}
        </Animated.View>
      </ScrollView>

      {/* ── CTA ── */}
      <View style={styles.footer}>
        {shareAfter ? (
          <>
            <Pressable
              style={({ pressed }) => [styles.doneButton, pressed && styles.doneButtonPressed]}
              onPress={handleShare}
              disabled={isSharing}
            >
              {isSharing ? (
                <ActivityIndicator size="small" color="#fff" style={styles.btnIcon} />
              ) : (
                <Ionicons name="share-social-outline" size={20} color="#fff" style={styles.btnIcon} />
              )}
              <Text style={styles.doneButtonText}>
                {isSharing ? 'Capturing...' : 'Share My Session'}
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.skipBtn, pressed && { opacity: 0.6 }]}
              onPress={handleDone}
            >
              <Text style={styles.skipBtnText}>Skip</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.doneButton, pressed && styles.doneButtonPressed]}
            onPress={handleDone}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color="#fff" style={styles.btnIcon} />
            <Text style={styles.doneButtonText}>Done</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow: 1,
  },
  inner: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 20,
    paddingBottom: 16,
    gap: 16,
  },
  captureArea: {
    backgroundColor: colors.background,
    gap: 16,
    paddingBottom: 8,
  },

  // ── Hero ───────────────────────────────────────────────────────────────────
  heroSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  glowRing: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(6,138,21,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 28,
    elevation: 14,
  },
  checkCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  heroTitle: {
    fontFamily: fonts.titleRegular,
    fontSize: 62,
    color: colors.textPrimary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    textAlign: 'center',
    lineHeight: 66,
    marginBottom: 10,
  },
  heroSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textSecondary,
    letterSpacing: 0.5,
    textAlign: 'center',
  },

  // ── Session stats ──────────────────────────────────────────────────────────
  sessionStatsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  sessionStat: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  sessionStatValue: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  sessionStatLabel: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textTertiary,
    letterSpacing: 0.3,
  },
  sessionStatDivider: {
    width: 1,
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },

  // ── Progress row ───────────────────────────────────────────────────────────
  progressRow: {
    flexDirection: 'row',
    gap: 10,
  },
  progressCard: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    gap: 6,
  },
  progressCardHighlight: {
    backgroundColor: colors.primaryDim,
    borderColor: colors.primary,
  },
  streakValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  flameIcon: { marginBottom: 3 },
  progressValue: {
    fontFamily: fonts.bold,
    fontSize: 30,
    color: colors.textPrimary,
    letterSpacing: 0.3,
    lineHeight: 34,
  },
  progressValueHighlight: {
    color: colors.primaryBright,
  },
  progressLabel: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 16,
    letterSpacing: 0.2,
  },
  progressLabelHighlight: {
    color: colors.primary,
  },

  // ── Coach message ──────────────────────────────────────────────────────────
  coachCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 20,
    padding: 20,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    gap: 12,
  },
  coachHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  coachAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primaryDim,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  coachMessage: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 26,
    color: colors.textPrimary,
    letterSpacing: 0.2,
  },

  // ── Level progress card ────────────────────────────────────────────────────
  levelCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    gap: 12,
  },
  levelCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  levelCardTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  levelCardNext: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.primary,
    letterSpacing: 0.3,
  },
  levelTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  levelFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  levelDots: {
    flexDirection: 'row',
    gap: 8,
  },
  levelDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.dotInactive,
  },
  levelDotFilled: {
    backgroundColor: colors.primary,
  },
  levelHint: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textSecondary,
    letterSpacing: 0.2,
  },

  // ── Footer CTA ─────────────────────────────────────────────────────────────
  footer: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 8,
    paddingTop: 12,
  },
  doneButton: {
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  doneButtonPressed: { opacity: 0.82 },
  btnIcon: { marginRight: 8 },
  doneButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: '#fff',
    letterSpacing: 0.3,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  skipBtnText: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textTertiary,
    letterSpacing: 0.3,
  },
});
