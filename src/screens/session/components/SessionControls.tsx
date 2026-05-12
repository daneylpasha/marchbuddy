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
}) => {
  return (
    <View style={styles.container}>
      {/* Pause / Resume — primary action */}
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

      {/* End early — tap opens confirmation modal */}
      <Pressable
        style={({ pressed }) => [styles.endButton, pressed && styles.endButtonPressed]}
        onPress={onEndEarly}
      >
        <Ionicons name="stop" size={16} color={colors.danger} />
        <Text style={styles.endButtonText}>End</Text>
      </Pressable>
    </View>
  );
};

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
    paddingHorizontal: 20,
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
    letterSpacing: 0.3,
  },
  endButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244,63,94,0.08)',
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderRadius: 30,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.3)',
  },
  endButtonPressed: {
    backgroundColor: 'rgba(244,63,94,0.18)',
    borderColor: colors.danger,
  },
  endButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.danger,
    letterSpacing: 0.3,
  },
});
