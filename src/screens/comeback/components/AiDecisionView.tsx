import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ComebackDecision } from '../../../types/comeback';
import { colors, fonts } from '../../../theme';


interface AiDecisionViewProps {
  decision: ComebackDecision;
  previousLevel: number;
  onAccept: () => void;
  onDiscuss: () => void;
}

export const AiDecisionView: React.FC<AiDecisionViewProps> = ({
  decision,
  previousLevel,
  onAccept,
  onDiscuss,
}) => {
  const levelDiff = previousLevel - decision.recommendedLevel;
  const aiUnavailable = decision.isAiUnavailable === true;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.iconContainer, aiUnavailable && styles.iconContainerWarning]}>
          <Ionicons
            name={aiUnavailable ? 'warning-outline' : 'bulb'}
            size={40}
            color={aiUnavailable ? colors.warning : colors.primary}
          />
        </View>
        <Text style={styles.title}>
          {aiUnavailable ? 'AI Unavailable' : 'My Recommendation'}
        </Text>
      </View>

      {/* AI unavailable notice */}
      {aiUnavailable && (
        <View style={styles.unavailableBox}>
          <Ionicons name="wifi-outline" size={18} color={colors.warning} />
          <Text style={styles.unavailableText}>
            Couldn't reach the AI coach right now. You've been kept at your current level — nothing has changed.
          </Text>
        </View>
      )}

      <View style={styles.levelContainer}>
        <Text style={styles.levelLabel}>{aiUnavailable ? 'Your level' : 'Start at'}</Text>
        <Text style={styles.levelNumber}>Level {decision.recommendedLevel}</Text>
        {!aiUnavailable && levelDiff > 0 && (
          <View style={styles.levelChange}>
            <Ionicons name="arrow-down" size={16} color={colors.textTertiary} />
            <Text style={styles.levelChangeText}>from Level {previousLevel}</Text>
          </View>
        )}
        {!aiUnavailable && levelDiff === 0 && (
          <Text style={styles.levelSame}>Same as before</Text>
        )}
        {aiUnavailable && (
          <Text style={styles.levelSame}>Unchanged — same as before</Text>
        )}
      </View>

      {!aiUnavailable && (
        <>
          <View style={styles.reasoningBox}>
            <View style={styles.reasoningHeader}>
              <Ionicons name="information-circle" size={20} color={colors.primary} />
              <Text style={styles.reasoningLabel}>WHY THIS LEVEL</Text>
            </View>
            <Text style={styles.reasoningText}>{decision.reasoning}</Text>
          </View>

          <View style={styles.encouragementBox}>
            <Text style={styles.encouragementText}>{decision.encouragement}</Text>
          </View>

          <View style={styles.tipBox}>
            <Ionicons name="flash" size={20} color={colors.warning} />
            <Text style={styles.tipText}>
              Good news: You'll progress faster this time. Muscle memory is real!
            </Text>
          </View>
        </>
      )}

      <View style={styles.buttons}>
        <TouchableOpacity style={styles.acceptButton} onPress={onAccept} activeOpacity={0.8}>
          <Text style={styles.acceptButtonText}>
            {aiUnavailable ? 'Continue at Level ' + decision.recommendedLevel : 'Sounds Good, Let\'s Go'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.discussButton} onPress={onDiscuss} activeOpacity={0.7}>
          <Ionicons name="chatbubbles-outline" size={20} color={colors.primary} />
          <Text style={styles.discussButtonText}>I'd like to discuss this</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryDim,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainerWarning: {
    backgroundColor: colors.warningDim,
  },
  unavailableBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.warningDim,
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
  },
  unavailableText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.warning,
    flex: 1,
    lineHeight: 20,
  },
  title: {
    fontFamily: fonts.titleRegular,
    fontSize: 28,
    color: colors.textPrimary,
  },
  levelContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  levelLabel: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textTertiary,
    marginBottom: 8,
  },
  levelNumber: {
    fontFamily: fonts.titleRegular,
    fontSize: 56,
    color: colors.primary,
    letterSpacing: 1,
  },
  levelChange: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  levelChangeText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textTertiary,
  },
  levelSame: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textTertiary,
    marginTop: 8,
  },
  reasoningBox: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  reasoningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  reasoningLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.primary,
  },
  reasoningText: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  encouragementBox: {
    marginBottom: 16,
  },
  encouragementText: {
    fontFamily: fonts.medium,
    fontSize: 16,
    fontStyle: 'italic',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningDim,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginBottom: 32,
  },
  tipText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.warning,
    flex: 1,
  },
  buttons: {
    gap: 12,
  },
  acceptButton: {
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
  },
  acceptButtonText: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textPrimary,
  },
  discussButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  discussButtonText: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.primary,
  },
});
