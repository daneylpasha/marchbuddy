import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../../theme';

interface RestDayCardProps {
  restType: 'active-recovery' | 'complete-rest' | null;
  aiNotes: string;
}

const MOBILITY_SUGGESTIONS = [
  'Foam roll quads, hamstrings, and upper back — 2 min each',
  'Hip flexor stretch — 60 seconds per side',
  'Cat-cow spinal flow — 10 reps, slow and controlled',
  'Shoulder pass-throughs with a band or towel — 15 reps',
  'Deep squat hold — accumulate 2 minutes total',
];

export default function RestDayCard({ restType, aiNotes }: RestDayCardProps) {
  const isActive = restType === 'active-recovery';
  const accent = isActive ? '#26a69a' : colors.primary;

  return (
    <View style={[styles.card, { borderLeftColor: accent }]}>
      <View style={styles.header}>
        <Ionicons name={isActive ? 'body-outline' : 'bed-outline'} size={24} color={accent} />
        <View style={styles.headerText}>
          <Text style={styles.title}>
            {isActive ? 'Active Recovery Day' : 'Complete Rest Day'}
          </Text>
          <Text style={styles.subtitle}>
            {isActive ? 'Light movement to aid recovery' : 'Your body rebuilds on rest days'}
          </Text>
        </View>
      </View>

      {aiNotes ? (
        <Text style={styles.aiNotes}>{aiNotes}</Text>
      ) : null}

      {isActive && (
        <View style={styles.suggestions}>
          <Text style={styles.suggestionsTitle}>Suggested mobility work</Text>
          {MOBILITY_SUGGESTIONS.map((item, i) => (
            <View key={i} style={styles.suggestionRow}>
              <View style={[styles.bulletDot, { backgroundColor: accent }]} />
              <Text style={styles.suggestionText}>{item}</Text>
            </View>
          ))}
        </View>
      )}

      {!isActive && (
        <View style={styles.restMessage}>
          <Text style={styles.restEmoji}>&#x1F9D8;</Text>
          <Text style={styles.restText}>
            Take it easy today. Stay hydrated, get quality sleep, and let your muscles recover. You've earned it.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    padding: 18,
    borderLeftWidth: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    fontFamily: fonts.bold,
    letterSpacing: 0.3,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
    marginTop: 2,
  },
  aiNotes: {
    color: '#aaa',
    fontSize: 14,
    fontStyle: 'italic',
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
    marginBottom: 14,
    lineHeight: 20,
  },
  suggestions: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 14,
  },
  suggestionsTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
    letterSpacing: 0.3,
    marginBottom: 10,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  suggestionText: {
    color: '#bbb',
    fontSize: 13,
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
    flex: 1,
    lineHeight: 19,
  },
  restMessage: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  restEmoji: {
    fontSize: 36,
    marginBottom: 10,
  },
  restText: {
    color: '#aaa',
    fontSize: 14,
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
    textAlign: 'center',
    lineHeight: 20,
  },
});
