import React from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../../theme';
import type { SwapAlternative } from '../../services/aiService';

interface ExerciseSwapSheetProps {
  visible: boolean;
  loading: boolean;
  exerciseName: string;
  alternatives: SwapAlternative[];
  onSelect: (alt: SwapAlternative) => void;
  onDismiss: () => void;
}

export default function ExerciseSwapSheet({
  visible,
  loading,
  exerciseName,
  alternatives,
  onSelect,
  onDismiss,
}: ExerciseSwapSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />

          <Text style={styles.title}>Swap Exercise</Text>
          <Text style={styles.subtitle}>
            Replace {exerciseName} with an alternative
          </Text>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Finding alternatives...</Text>
            </View>
          ) : (
            <ScrollView style={styles.listScroll} showsVerticalScrollIndicator={false}>
              {alternatives.map((alt, i) => (
                <Pressable key={i} style={styles.altCard} onPress={() => onSelect(alt)}>
                  <View style={styles.altHeader}>
                    <Text style={styles.altName}>{alt.name}</Text>
                    <View style={styles.altMuscleBadge}>
                      <Text style={styles.altMuscleText}>{alt.muscleGroup}</Text>
                    </View>
                  </View>

                  <View style={styles.altStatsRow}>
                    <Text style={styles.altStat}>{alt.sets} sets</Text>
                    <Text style={styles.altStatDot}>{'\u00B7'}</Text>
                    <Text style={styles.altStat}>{alt.reps} reps</Text>
                    {alt.weight != null && (
                      <>
                        <Text style={styles.altStatDot}>{'\u00B7'}</Text>
                        <Text style={styles.altStat}>{alt.weight}kg</Text>
                      </>
                    )}
                  </View>

                  <Text style={styles.altReason}>{alt.reason}</Text>

                  <View style={styles.selectRow}>
                    <Ionicons name="swap-horizontal" size={14} color={colors.primary} />
                    <Text style={styles.selectText}>Tap to swap</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#00000088',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 12,
    maxHeight: '70%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textMuted,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    fontFamily: fonts.bold,
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
    marginBottom: 20,
  },
  loadingBox: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
  },
  listScroll: {
    flex: 1,
  },
  altCard: {
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  altHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  altName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
    letterSpacing: 0.3,
    flex: 1,
  },
  altMuscleBadge: {
    backgroundColor: colors.primaryDim,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  altMuscleText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
    letterSpacing: 0.3,
  },
  altStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  altStat: {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
  },
  altStatDot: {
    color: colors.textMuted,
    fontSize: 13,
  },
  altReason: {
    color: colors.textTertiary,
    fontSize: 12,
    fontStyle: 'italic',
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  selectText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
    letterSpacing: 0.3,
  },
});
