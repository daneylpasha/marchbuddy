import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FitnessFeeling } from '../../../types/comeback';
import { colors, fonts } from '../../../theme';

interface FitnessCheckFormProps {
  previousLevel: number;
  onSubmit: (feeling: FitnessFeeling) => void;
  onBack: () => void;
}

const OPTIONS: { value: FitnessFeeling; label: string; description: string; icon: string }[] = [
  {
    value: 'too_easy',
    label: 'Too Easy',
    description: 'I could do even more than that',
    icon: 'rocket-outline',
  },
  {
    value: 'comfortable',
    label: 'Comfortable',
    description: 'That would feel about right',
    icon: 'checkmark-circle-outline',
  },
  {
    value: 'challenging',
    label: 'Challenging',
    description: "I'd have to push myself",
    icon: 'fitness-outline',
  },
  {
    value: 'too_hard',
    label: 'Too Hard',
    description: "I'd really struggle with that",
    icon: 'warning-outline',
  },
];

export const FitnessCheckForm: React.FC<FitnessCheckFormProps> = ({
  previousLevel,
  onSubmit,
  onBack,
}) => {
  const [selected, setSelected] = useState<FitnessFeeling | null>(null);

  const handleSubmit = () => {
    if (selected) {
      onSubmit(selected);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <Ionicons name="body-outline" size={48} color={colors.primary} />
        <Text style={styles.title}>Quick Fitness Check</Text>
        <Text style={styles.subtitle}>
          Imagine doing your Level {previousLevel} session right now.{'\n'}
          How would that feel?
        </Text>
      </View>

      <View style={styles.options}>
        {OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[styles.option, selected === option.value && styles.optionSelected]}
            onPress={() => setSelected(option.value)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.optionIcon,
                selected === option.value && styles.optionIconSelected,
              ]}
            >
              <Ionicons
                name={option.icon as any}
                size={24}
                color={selected === option.value ? colors.textPrimary : colors.primary}
              />
            </View>
            <View style={styles.optionContent}>
              <Text
                style={[
                  styles.optionLabel,
                  selected === option.value && styles.optionLabelSelected,
                ]}
              >
                {option.label}
              </Text>
              <Text style={styles.optionDescription}>{option.description}</Text>
            </View>
            {selected === option.value && (
              <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.submitButton, !selected && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={!selected}
        activeOpacity={0.8}
      >
        <Text style={styles.submitButtonText}>Get My Recommendation</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 16,
  },
  backText: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.textPrimary,
    marginLeft: 4,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontFamily: fonts.titleRegular,
    fontSize: 28,
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 12,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  options: {
    gap: 12,
    marginBottom: 32,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDim,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryDim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionIconSelected: {
    backgroundColor: colors.primary,
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  optionLabelSelected: {
    color: colors.primary,
  },
  optionDescription: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  submitButton: {
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textPrimary,
  },
});
