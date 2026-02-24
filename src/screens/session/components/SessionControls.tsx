import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../../../theme';

interface SessionControlsProps {
  isPaused: boolean;
  onPauseResume: () => void;
  onEndEarly: () => void;
}

export const SessionControls: React.FC<SessionControlsProps> = ({
  isPaused,
  onPauseResume,
  onEndEarly,
}) => (
  <View style={styles.container}>
    {/* Pause / Resume */}
    <Pressable
      style={({ pressed }) => [
        styles.mainButton,
        isPaused && styles.mainButtonResuming,
        pressed && styles.pressed,
      ]}
      onPress={onPauseResume}
    >
      <Ionicons name={isPaused ? 'play' : 'pause'} size={28} color="#fff" />
      <Text style={styles.mainButtonText}>{isPaused ? 'Resume' : 'Pause'}</Text>
    </Pressable>

    {/* End early */}
    <Pressable
      style={({ pressed }) => [styles.endButton, pressed && styles.pressed]}
      onPress={onEndEarly}
    >
      <Ionicons name="stop" size={22} color={colors.danger} />
      <Text style={styles.endButtonText}>End Early</Text>
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 14,
  },
  mainButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: 30,
    gap: 10,
  },
  mainButtonResuming: {
    backgroundColor: colors.success,
  },
  pressed: {
    opacity: 0.8,
  },
  mainButtonText: {
    fontFamily: fonts.bold,
    fontSize: 17,
    color: '#fff',
  },
  endButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,61,113,0.1)',
    paddingVertical: 18,
    borderRadius: 30,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  endButtonText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.danger,
  },
});
