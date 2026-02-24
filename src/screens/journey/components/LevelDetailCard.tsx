import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { LevelDefinition } from '../../../types/session';
import { colors, fonts, spacing } from '../../../theme';

interface LevelDetailCardProps {
  level: LevelDefinition;
  isCurrentLevel: boolean;
  isCompleted: boolean;
  sessionsCompleted: number;
  onClose: () => void;
}

export const LevelDetailCard: React.FC<LevelDetailCardProps> = ({
  level,
  isCurrentLevel,
  isCompleted,
  sessionsCompleted,
  onClose,
}) => {
  const template = level.recommendedTemplate;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.levelLabel}>LEVEL {level.level}</Text>
              <Text style={styles.levelName}>{level.name}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Focus pill */}
          <View style={styles.focusContainer}>
            <Text style={styles.focusLabel}>FOCUS</Text>
            <Text style={styles.focusText}>{level.focus}</Text>
          </View>

          {/* Description */}
          <Text style={styles.description}>{level.description}</Text>

          {/* Typical session */}
          <View style={styles.sessionPreview}>
            <Text style={styles.sessionLabel}>TYPICAL SESSION</Text>
            <View style={styles.sessionInfo}>
              <Text style={styles.sessionTitle}>{template.title}</Text>
              <Text style={styles.sessionDuration}>{template.totalDurationMinutes} min</Text>
            </View>
            <Text style={styles.sessionSummary}>{template.summary}</Text>
          </View>

          {/* Status */}
          <View style={styles.statusContainer}>
            {isCompleted && (
              <View style={styles.statusBadge}>
                <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                <Text style={styles.statusText}>Completed</Text>
              </View>
            )}
            {isCurrentLevel && (
              <View style={styles.progressInfo}>
                <Text style={styles.progressLabel}>{sessionsCompleted}/3 sessions done</Text>
                <View style={styles.progressDots}>
                  {[0, 1, 2].map((i) => (
                    <View
                      key={i}
                      style={[styles.dot, i < sessionsCompleted ? styles.dotFilled : styles.dotEmpty]}
                    />
                  ))}
                </View>
              </View>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    paddingHorizontal: spacing.screenPadding,
  },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  levelLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.primary,
    marginBottom: 4,
  },
  levelName: {
    fontFamily: fonts.titleRegular,
    fontSize: 26,
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  closeButton: {
    padding: 2,
  },
  focusContainer: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  focusLabel: {
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 1.2,
    color: colors.textTertiary,
    marginBottom: 4,
  },
  focusText: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.textPrimary,
    letterSpacing: 0.2,
  },
  description: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
    letterSpacing: 0.2,
    marginBottom: 18,
  },
  sessionPreview: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surfaceBorder,
    paddingTop: 14,
    marginBottom: 14,
  },
  sessionLabel: {
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 1.2,
    color: colors.textTertiary,
    marginBottom: 8,
  },
  sessionInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sessionTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.textPrimary,
    letterSpacing: 0.2,
    flex: 1,
  },
  sessionDuration: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.primaryBright,
    letterSpacing: 0.3,
  },
  sessionSummary: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textTertiary,
    letterSpacing: 0.2,
  },
  statusContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surfaceBorder,
    paddingTop: 14,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.primary,
    letterSpacing: 0.2,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    letterSpacing: 0.2,
  },
  progressDots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dotFilled: {
    backgroundColor: colors.primary,
  },
  dotEmpty: {
    backgroundColor: colors.surfaceBorder,
  },
});
