import React from 'react';
import { View, StyleSheet } from 'react-native';
import type { LevelDefinition } from '../../../types/session';
import { LevelNode } from './LevelNode';
import { colors } from '../../../theme';

interface JourneyPathProps {
  levels: LevelDefinition[];
  currentLevel: number;
  sessionsAtCurrentLevel: number;
  selectedLevel: number | null;
  onLevelPress: (level: number) => void;
}

export const JourneyPath: React.FC<JourneyPathProps> = ({
  levels,
  currentLevel,
  sessionsAtCurrentLevel,
  selectedLevel,
  onLevelPress,
}) => {
  // Render 16 at top → 1 at bottom
  const reversedLevels = [...levels].sort((a, b) => b.level - a.level);

  return (
    <View style={styles.container}>
      {reversedLevels.map((levelDef, index) => {
        const isCompleted = levelDef.level < currentLevel;
        const isCurrent = levelDef.level === currentLevel;
        const isLocked = levelDef.level > currentLevel;
        const isLastNode = index === reversedLevels.length - 1;

        // Line above this node (connects it to the node above = higher level)
        // Active (green) if this level is fully completed (level < currentLevel)
        const lineAboveActive = levelDef.level < currentLevel;

        return (
          <View key={levelDef.level} style={styles.nodeWrapper}>
            {/* Connecting line above (skip for the very first node = level 16) */}
            {index > 0 && (
              <View style={[
                styles.connectingLine,
                lineAboveActive ? styles.lineActive : styles.lineInactive,
              ]} />
            )}

            <LevelNode
              level={levelDef}
              isCompleted={isCompleted}
              isCurrent={isCurrent}
              isLocked={isLocked}
              isSelected={selectedLevel === levelDef.level}
              sessionsCompleted={isCurrent ? sessionsAtCurrentLevel : isCompleted ? 3 : 0}
              onPress={() => onLevelPress(levelDef.level)}
            />

            {/* Line below the last node (level 1) connecting to Start point */}
            {isLastNode && (
              <View style={[styles.connectingLine, styles.lineActive]} />
            )}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
    paddingHorizontal: 4,
  },
  nodeWrapper: {
    width: '100%',
    alignItems: 'flex-start',
  },
  connectingLine: {
    width: 3,
    height: 36,
    borderRadius: 1.5,
    marginLeft: 18, // aligns with center of small node (40px/2 - 1.5px)
  },
  lineActive: {
    backgroundColor: colors.primary,
  },
  lineInactive: {
    backgroundColor: colors.surfaceBorder,
  },
});
