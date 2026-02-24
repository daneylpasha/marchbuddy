import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../../theme';

interface RPEPickerModalProps {
  visible: boolean;
  onSelect: (rpe: number) => void;
  onSkip: () => void;
}

const RPE_OPTIONS: { value: number; label: string; color: string }[] = [
  { value: 1, label: 'Rest', color: '#4caf50' },
  { value: 2, label: 'Easy', color: '#66bb6a' },
  { value: 3, label: 'Light', color: '#8bc34a' },
  { value: 4, label: 'Moderate', color: '#cddc39' },
  { value: 5, label: 'Medium', color: '#ffeb3b' },
  { value: 6, label: 'Tough', color: '#ffc107' },
  { value: 7, label: 'Hard', color: '#ff9800' },
  { value: 8, label: 'Very Hard', color: '#ff5722' },
  { value: 9, label: 'Max Effort', color: '#f44336' },
  { value: 10, label: 'All Out', color: '#d32f2f' },
];

export default function RPEPickerModal({ visible, onSelect, onSkip }: RPEPickerModalProps) {
  const [selected, setSelected] = useState<number | null>(null);

  const handleConfirm = () => {
    if (selected !== null) {
      onSelect(selected);
      setSelected(null);
    }
  };

  const handleSkip = () => {
    setSelected(null);
    onSkip();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleSkip}
    >
      <Pressable style={styles.backdrop} onPress={handleSkip}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />

          <Text style={styles.title}>How hard was that?</Text>
          <Text style={styles.subtitle}>Rate your perceived exertion (RPE)</Text>

          {/* RPE grid: 2 rows of 5 */}
          <View style={styles.grid}>
            {RPE_OPTIONS.slice(0, 5).map((opt) => (
              <Pressable
                key={opt.value}
                style={[
                  styles.rpeBtn,
                  selected === opt.value && { backgroundColor: opt.color + '33', borderColor: opt.color },
                ]}
                onPress={() => setSelected(opt.value)}
              >
                <Text style={[styles.rpeNumber, selected === opt.value && { color: opt.color }]}>
                  {opt.value}
                </Text>
                <Text style={[styles.rpeLabel, selected === opt.value && { color: opt.color }]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.grid}>
            {RPE_OPTIONS.slice(5).map((opt) => (
              <Pressable
                key={opt.value}
                style={[
                  styles.rpeBtn,
                  selected === opt.value && { backgroundColor: opt.color + '33', borderColor: opt.color },
                ]}
                onPress={() => setSelected(opt.value)}
              >
                <Text style={[styles.rpeNumber, selected === opt.value && { color: opt.color }]}>
                  {opt.value}
                </Text>
                <Text style={[styles.rpeLabel, selected === opt.value && { color: opt.color }]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Confirm / Skip */}
          <Pressable
            style={[styles.confirmBtn, selected === null && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={selected === null}
          >
            <Text style={styles.confirmBtnText}>Save</Text>
          </Pressable>

          <Pressable style={styles.skipBtn} onPress={handleSkip}>
            <Text style={styles.skipBtnText}>Skip</Text>
          </Pressable>
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
    alignItems: 'center',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textMuted,
    marginBottom: 20,
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
  grid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
    width: '100%',
  },
  rpeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: 'transparent',
    minHeight: 48,
  },
  rpeNumber: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    fontFamily: fonts.bold,
  },
  rpeLabel: {
    color: colors.textTertiary,
    fontSize: 9,
    fontWeight: '500',
    fontFamily: fonts.medium,
    letterSpacing: 0.2,
    marginTop: 2,
  },
  confirmBtn: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 12,
    minHeight: 48,
  },
  confirmBtnDisabled: {
    backgroundColor: colors.dotInactive,
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: fonts.bold,
    letterSpacing: 0.3,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  skipBtnText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
  },
});
