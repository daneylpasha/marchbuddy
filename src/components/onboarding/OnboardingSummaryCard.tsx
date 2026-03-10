import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, fonts, spacing, typography } from '../../theme';
import type { OnboardingData } from '../../services/onboardingService';
import { SUMMARY_FIELDS, formatDisplayValue } from '../../services/onboardingService';

interface OnboardingSummaryCardProps {
  data: OnboardingData;
  onEdit: (field: keyof OnboardingData, value: any) => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export default function OnboardingSummaryCard({
  data,
  onEdit,
  onConfirm,
  isLoading,
}: OnboardingSummaryCardProps) {
  const [editingField, setEditingField] = useState<keyof OnboardingData | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleStartEdit = (key: keyof OnboardingData) => {
    const current = data[key];
    setEditValue(current === 0 ? '' : String(current));
    setEditingField(key);
  };

  const handleSaveEdit = (key: keyof OnboardingData) => {
    const field = SUMMARY_FIELDS.find((f) => f.key === key);
    if (!field) return;

    let parsed: any = editValue.trim();
    if (field.inputType === 'number') {
      parsed = Number(editValue);
      if (isNaN(parsed)) return; // don't save invalid numbers
      if (field.numberMin !== undefined && parsed < field.numberMin) return;
      if (field.numberMax !== undefined && parsed > field.numberMax) return;
    }

    onEdit(key, parsed);
    setEditingField(null);
    setEditValue('');
  };

  const handleChipSelect = (key: keyof OnboardingData, option: string) => {
    // For gender, store lowercase to match existing parse behavior
    const value = key === 'gender' ? option.toLowerCase() : option;
    onEdit(key, value);
    setEditingField(null);
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <Text style={styles.title}>Here's what I've got, {data.name || 'friend'}</Text>
        <Text style={styles.subtitle}>Tap any field to edit it</Text>

        {/* Summary rows */}
        <View style={styles.card}>
          {SUMMARY_FIELDS.map((field, index) => {
            const isEditing = editingField === field.key;
            const isLast = index === SUMMARY_FIELDS.length - 1;

            return (
              <View key={field.key}>
                <Pressable
                  style={[styles.row, isEditing && styles.rowEditing]}
                  onPress={() => !isEditing && handleStartEdit(field.key)}
                >
                  <Text style={styles.rowLabel}>{field.label}</Text>
                  {!isEditing && (
                    <View style={styles.rowValueContainer}>
                      <Text style={styles.rowValue}>
                        {formatDisplayValue(field.key, data[field.key])}
                      </Text>
                      <Text style={styles.editIcon}>Edit</Text>
                    </View>
                  )}
                </Pressable>

                {/* Inline editor */}
                {isEditing && field.inputType === 'select' && field.options && (
                  <View style={styles.chipContainer}>
                    {field.options.map((option) => {
                      const currentVal = String(data[field.key]).toLowerCase();
                      const isSelected = currentVal === option.toLowerCase();
                      return (
                        <Pressable
                          key={option}
                          style={[styles.chip, isSelected && styles.chipSelected]}
                          onPress={() => handleChipSelect(field.key, option)}
                        >
                          <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                            {option}
                          </Text>
                        </Pressable>
                      );
                    })}
                    <Pressable style={styles.cancelButton} onPress={handleCancelEdit}>
                      <Text style={styles.cancelText}>Cancel</Text>
                    </Pressable>
                  </View>
                )}

                {isEditing && (field.inputType === 'text' || field.inputType === 'number') && (
                  <View style={styles.inlineInputContainer}>
                    <TextInput
                      style={styles.inlineInput}
                      value={editValue}
                      onChangeText={setEditValue}
                      keyboardType={field.inputType === 'number' ? 'numeric' : 'default'}
                      placeholder={field.numberUnit ? `Enter ${field.numberUnit}` : 'Type here...'}
                      placeholderTextColor={colors.textTertiary}
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={() => handleSaveEdit(field.key)}
                    />
                    <Pressable
                      style={styles.saveButton}
                      onPress={() => handleSaveEdit(field.key)}
                    >
                      <Text style={styles.saveButtonText}>Save</Text>
                    </Pressable>
                    <Pressable style={styles.cancelButton} onPress={handleCancelEdit}>
                      <Text style={styles.cancelText}>Cancel</Text>
                    </Pressable>
                  </View>
                )}

                {!isLast && <View style={styles.divider} />}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* CTA */}
      <View style={styles.ctaContainer}>
        <Pressable
          style={[styles.ctaButton, isLoading && styles.ctaButtonDisabled]}
          onPress={onConfirm}
          disabled={isLoading}
        >
          <Text style={styles.ctaText}>
            {isLoading ? 'Building your plan...' : "Looks good — let's go!"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.screenPadding,
    paddingBottom: 120,
  },
  title: {
    ...typography.screenTitle,
    marginBottom: 4,
  },
  subtitle: {
    ...typography.bodySecondary,
    marginBottom: spacing.xl,
  },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: spacing.cardRadius,
    paddingVertical: 4,
    paddingHorizontal: spacing.cardPadding,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    minHeight: 52,
  },
  rowEditing: {
    paddingBottom: 8,
  },
  rowLabel: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },
  rowValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
    maxWidth: '60%',
  },
  rowValue: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.textPrimary,
    letterSpacing: 0.3,
    textAlign: 'right',
  },
  editIcon: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.primary,
    letterSpacing: 0.3,
  },
  divider: {
    height: 1,
    backgroundColor: colors.surfaceBorder,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 12,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: colors.dotInactive,
    borderWidth: 1,
    borderColor: colors.textMuted,
  },
  chipSelected: {
    backgroundColor: colors.primaryDim,
    borderColor: colors.primary,
  },
  chipText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  chipTextSelected: {
    color: colors.primaryBright,
  },
  inlineInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 12,
  },
  inlineInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    borderWidth: 1,
    borderColor: colors.primary,
    letterSpacing: 0.3,
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  saveButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  cancelText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textTertiary,
    letterSpacing: 0.3,
  },
  ctaContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 36,
    paddingTop: 16,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
  },
  ctaButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  ctaButtonDisabled: {
    opacity: 0.6,
  },
  ctaText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});
