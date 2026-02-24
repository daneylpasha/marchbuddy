import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { LevelDefinition } from '../../../types/session';
import { colors, fonts } from '../../../theme';

interface LevelNodeProps {
  level: LevelDefinition;
  isCompleted: boolean;
  isCurrent: boolean;
  isLocked: boolean;
  isSelected: boolean;
  sessionsCompleted: number;
  onPress: () => void;
}

export const LevelNode: React.FC<LevelNodeProps> = ({
  level,
  isCompleted,
  isCurrent,
  isLocked,
  isSelected,
  sessionsCompleted,
  onPress,
}) => {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      disabled={isLocked}
      activeOpacity={0.7}
    >
      <View style={styles.row}>
        {/* Node circle */}
        <View style={[
          styles.node,
          isCurrent ? styles.nodeLarge : styles.nodeSmall,
          isCompleted ? styles.nodeCompleted : isCurrent ? styles.nodeCurrent : styles.nodeLocked,
          isSelected && styles.nodeSelected,
        ]}>
          {isCompleted && (
            <Ionicons name="checkmark" size={isCurrent ? 24 : 16} color="#FFFFFF" />
          )}
          {isCurrent && (
            <Text style={styles.currentLevelText}>L{level.level}</Text>
          )}
          {isLocked && (
            <Ionicons name="lock-closed" size={12} color={colors.textTertiary} />
          )}
        </View>

        {/* Level info */}
        <View style={styles.info}>
          <View style={styles.titleRow}>
            <Text style={[
              styles.levelNumber,
              isLocked ? styles.textLocked : isCurrent ? styles.textCurrent : styles.textCompleted,
            ]}>
              Level {level.level}
            </Text>
            {isCurrent && (
              <View style={styles.currentBadge}>
                <Text style={styles.currentBadgeText}>YOU ARE HERE</Text>
              </View>
            )}
            {isCompleted && (
              <Text style={styles.checkLabel}>✓</Text>
            )}
          </View>

          <Text style={[styles.levelName, isLocked && styles.textLocked]}>
            {level.name}
          </Text>

          {isCurrent && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[styles.progressFill, { width: `${Math.min((sessionsCompleted / 3) * 100, 100)}%` }]}
                />
              </View>
              <Text style={styles.progressText}>{sessionsCompleted}/3</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  node: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    flexShrink: 0,
  },
  nodeSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  nodeLarge: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  nodeCompleted: {
    backgroundColor: colors.primary,
  },
  nodeCurrent: {
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.primaryBright,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 10,
    elevation: 8,
  },
  nodeLocked: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  nodeSelected: {
    transform: [{ scale: 1.08 }],
  },
  currentLevelText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  info: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  levelNumber: {
    fontFamily: fonts.bold,
    fontSize: 15,
    letterSpacing: 0.2,
  },
  textCompleted: {
    color: colors.textPrimary,
  },
  textCurrent: {
    color: colors.primaryBright,
  },
  textLocked: {
    color: colors.textTertiary,
  },
  currentBadge: {
    backgroundColor: colors.primaryDim,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  currentBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 8,
    letterSpacing: 0.8,
    color: colors.primary,
  },
  checkLabel: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.primary,
  },
  levelName: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    letterSpacing: 0.2,
  },
  progressContainer: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primaryBright,
    borderRadius: 2,
  },
  progressText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textTertiary,
    minWidth: 28,
  },
});
