import React, { useState } from 'react';
import { LayoutAnimation, Modal, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';
import { colors, fonts } from '../../theme';
import type { ReadinessCheck } from '../../types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface EnergyCheckModalProps {
  visible: boolean;
  onSelect: (readiness: ReadinessCheck) => void;
  onRequestRecovery?: () => void;
  onDismiss: () => void;
}

type Step = 'energy' | 'sleep' | 'stress' | 'time' | 'lowEnergy';

const ENERGY_OPTIONS: { level: 1 | 2 | 3 | 4 | 5; emoji: string; label: string }[] = [
  { level: 1, emoji: '\u{1F634}', label: 'Exhausted' },
  { level: 2, emoji: '\u{1F614}', label: 'Tired' },
  { level: 3, emoji: '\u{1F610}', label: 'Okay' },
  { level: 4, emoji: '\u{1F642}', label: 'Good' },
  { level: 5, emoji: '\u{1F525}', label: 'Energized' },
];

const SLEEP_OPTIONS: { level: 1 | 2 | 3 | 4 | 5; emoji: string; label: string }[] = [
  { level: 1, emoji: '\u{1F62B}', label: 'Terrible' },
  { level: 2, emoji: '\u{1F974}', label: 'Poor' },
  { level: 3, emoji: '\u{1F610}', label: 'Okay' },
  { level: 4, emoji: '\u{1F60C}', label: 'Good' },
  { level: 5, emoji: '\u{1F634}', label: 'Great' },
];

const STRESS_OPTIONS: { level: 1 | 2 | 3 | 4 | 5; emoji: string; label: string }[] = [
  { level: 1, emoji: '\u{1F922}', label: 'Extreme' },
  { level: 2, emoji: '\u{1F630}', label: 'High' },
  { level: 3, emoji: '\u{1F610}', label: 'Moderate' },
  { level: 4, emoji: '\u{1F60C}', label: 'Low' },
  { level: 5, emoji: '\u{2728}', label: 'Calm' },
];

const TIME_OPTIONS: { minutes: 15 | 30 | 45 | 60; label: string }[] = [
  { minutes: 15, label: '15 min' },
  { minutes: 30, label: '30 min' },
  { minutes: 45, label: '45 min' },
  { minutes: 60, label: '60 min' },
];

const STEP_LABELS: Record<Step, { title: string; subtitle: string }> = {
  energy: { title: "How's your energy?", subtitle: 'This helps personalize your workout' },
  sleep: { title: 'How did you sleep?', subtitle: 'Sleep affects recovery and performance' },
  stress: { title: 'Stress level today?', subtitle: 'High stress = smarter workout adjustments' },
  time: { title: 'How much time do you have?', subtitle: "We'll fit your workout to your schedule" },
  lowEnergy: { title: 'Low energy today', subtitle: '' },
};

const STEP_ORDER: Step[] = ['energy', 'sleep', 'stress', 'time'];

export default function EnergyCheckModal({ visible, onSelect, onRequestRecovery, onDismiss }: EnergyCheckModalProps) {
  const [step, setStep] = useState<Step>('energy');
  const [energy, setEnergy] = useState<(1 | 2 | 3 | 4 | 5) | null>(null);
  const [sleep, setSleep] = useState<(1 | 2 | 3 | 4 | 5) | null>(null);
  const [stress, setStress] = useState<(1 | 2 | 3 | 4 | 5) | null>(null);
  const [time, setTime] = useState<(15 | 30 | 45 | 60) | null>(null);

  const animateTransition = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  };

  const goNext = () => {
    const currentIdx = STEP_ORDER.indexOf(step);
    if (currentIdx < STEP_ORDER.length - 1) {
      animateTransition();
      setStep(STEP_ORDER[currentIdx + 1]);
    }
  };

  const handleEnergySelect = (level: 1 | 2 | 3 | 4 | 5) => {
    setEnergy(level);
    if (level <= 2) {
      animateTransition();
      setStep('lowEnergy');
    } else {
      goNext();
    }
  };

  const handleSleepSelect = (level: 1 | 2 | 3 | 4 | 5) => {
    setSleep(level);
    goNext();
  };

  const handleStressSelect = (level: 1 | 2 | 3 | 4 | 5) => {
    setStress(level);
    goNext();
  };

  const handleTimeSelect = (minutes: 15 | 30 | 45 | 60) => {
    setTime(minutes);
    // Final step — submit readiness
    const readiness: ReadinessCheck = {
      energyLevel: energy!,
      sleepQuality: sleep ?? undefined,
      stressLevel: stress ?? undefined,
      timeAvailable: minutes,
    };
    onSelect(readiness);
  };

  const handleKeepGoing = () => {
    animateTransition();
    setStep('sleep'); // Continue to sleep step after low energy
  };

  const handleRecovery = () => {
    const readiness: ReadinessCheck = {
      energyLevel: energy!,
      sleepQuality: sleep ?? undefined,
      stressLevel: stress ?? undefined,
    };
    onSelect(readiness);
    onRequestRecovery?.();
  };

  const handleClose = () => {
    resetState();
    onDismiss();
  };

  const resetState = () => {
    setStep('energy');
    setEnergy(null);
    setSleep(null);
    setStress(null);
    setTime(null);
  };

  // Progress dots
  const currentStepIdx = step === 'lowEnergy' ? 0 : STEP_ORDER.indexOf(step);

  const renderFiveOptions = (
    options: { level: 1 | 2 | 3 | 4 | 5; emoji: string; label: string }[],
    selected: number | null,
    onPress: (level: 1 | 2 | 3 | 4 | 5) => void,
  ) => (
    <View style={styles.optionsRow}>
      {options.map((opt) => (
        <Pressable
          key={opt.level}
          style={[styles.optionBtn, selected === opt.level && styles.optionBtnSelected]}
          onPress={() => onPress(opt.level)}
        >
          <Text style={styles.emoji}>{opt.emoji}</Text>
          <Text style={[styles.optionLabel, selected === opt.level && styles.optionLabelSelected]}>
            {opt.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  const label = STEP_LABELS[step];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />

          {/* Progress dots */}
          <View style={styles.dotsRow}>
            {STEP_ORDER.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i <= currentStepIdx && styles.dotActive]}
              />
            ))}
          </View>

          {step === 'lowEnergy' ? (
            <>
              <Text style={styles.lowEnergyEmoji}>{'\u{1F4A4}'}</Text>
              <Text style={styles.title}>{label.title}</Text>
              <Text style={styles.lowEnergyText}>
                No worries! Want to switch to a lighter recovery session instead?
              </Text>
              <View style={styles.lowEnergyActions}>
                <Pressable style={styles.recoveryBtn} onPress={handleRecovery}>
                  <Text style={styles.recoveryBtnText}>Switch to Recovery</Text>
                </Pressable>
                <Pressable style={styles.keepGoingBtn} onPress={handleKeepGoing}>
                  <Text style={styles.keepGoingBtnText}>Keep Going</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.title}>{label.title}</Text>
              <Text style={styles.subtitle}>{label.subtitle}</Text>

              {step === 'energy' && renderFiveOptions(ENERGY_OPTIONS, energy, handleEnergySelect)}
              {step === 'sleep' && renderFiveOptions(SLEEP_OPTIONS, sleep, handleSleepSelect)}
              {step === 'stress' && renderFiveOptions(STRESS_OPTIONS, stress, handleStressSelect)}
              {step === 'time' && (
                <View style={styles.timeRow}>
                  {TIME_OPTIONS.map((opt) => (
                    <Pressable
                      key={opt.minutes}
                      style={[styles.timeBtn, time === opt.minutes && styles.timeBtnSelected]}
                      onPress={() => handleTimeSelect(opt.minutes)}
                    >
                      <Text style={[styles.timeLabel, time === opt.minutes && styles.timeLabelSelected]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </>
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
    alignItems: 'center',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textMuted,
    marginBottom: 12,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.dotInactive,
  },
  dotActive: {
    backgroundColor: colors.primary,
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
    marginBottom: 24,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  optionBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.background,
    minHeight: 48,
  },
  optionBtnSelected: {
    backgroundColor: colors.primary,
  },
  emoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  optionLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '500',
    fontFamily: fonts.medium,
    letterSpacing: 0.3,
  },
  optionLabelSelected: {
    color: '#fff',
  },
  timeRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  timeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: colors.background,
    minHeight: 48,
  },
  timeBtnSelected: {
    backgroundColor: colors.primary,
  },
  timeLabel: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
    letterSpacing: 0.3,
  },
  timeLabelSelected: {
    color: '#fff',
  },
  lowEnergyEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  lowEnergyText: {
    color: '#aaa',
    fontSize: 15,
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  lowEnergyActions: {
    width: '100%',
    gap: 10,
  },
  recoveryBtn: {
    backgroundColor: '#26a69a',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    minHeight: 48,
  },
  recoveryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: fonts.bold,
    letterSpacing: 0.3,
  },
  keepGoingBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  keepGoingBtnText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
  },
});
