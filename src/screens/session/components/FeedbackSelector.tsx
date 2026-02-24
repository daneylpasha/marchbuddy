import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { FeedbackRating } from '../../../types/session';
import { colors, fonts } from '../../../theme';

interface FeedbackSelectorProps {
  selected: FeedbackRating | null;
  onSelect: (rating: FeedbackRating) => void;
}

const FEEDBACK_OPTIONS: { rating: FeedbackRating; label: string; description: string }[] = [
  { rating: 'too_easy',    label: 'Too Easy',    description: 'Could have done more' },
  { rating: 'just_right',  label: 'Just Right',  description: 'Perfect challenge' },
  { rating: 'challenging', label: 'Challenging', description: 'Pushed myself' },
  { rating: 'too_hard',    label: 'Too Hard',    description: 'Really struggled' },
];

export const FeedbackSelector: React.FC<FeedbackSelectorProps> = ({ selected, onSelect }) => (
  <View style={styles.container}>
    {FEEDBACK_OPTIONS.map((option) => {
      const isSelected = selected === option.rating;

      return (
        <Pressable
          key={option.rating}
          style={({ pressed }) => [
            styles.option,
            isSelected && styles.optionSelected,
            pressed && styles.optionPressed,
          ]}
          onPress={() => onSelect(option.rating)}
        >
          <Text style={[styles.label, isSelected && styles.labelSelected]}>
            {option.label}
          </Text>
          <Text style={[styles.description, isSelected && styles.descriptionSelected]}>
            {option.description}
          </Text>
        </Pressable>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  option: {
    width: '47%',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDim,
  },
  optionPressed: {
    opacity: 0.75,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  labelSelected: {
    color: colors.primary,
  },
  description: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  descriptionSelected: {
    color: colors.primaryBright,
  },
});
