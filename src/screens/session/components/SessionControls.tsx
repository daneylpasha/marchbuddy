import React, { useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../../../theme';

interface SessionControlsProps {
  isPaused: boolean;
  onPauseResume: () => void;
  onEndEarly: () => void;
}

const LONG_PRESS_DURATION = 800; // ms to hold before End Early triggers

export const SessionControls: React.FC<SessionControlsProps> = ({
  isPaused,
  onPauseResume,
  onEndEarly,
}) => {
  const [isHoldingEnd, setIsHoldingEnd] = useState(false);
  const holdProgressAnim = useRef(new Animated.Value(0)).current;
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  const startHold = () => {
    setIsHoldingEnd(true);
    holdProgressAnim.setValue(0);

    // Start fill animation
    holdAnimRef.current = Animated.timing(holdProgressAnim, {
      toValue: 1,
      duration: LONG_PRESS_DURATION,
      useNativeDriver: false,
    });
    holdAnimRef.current.start();

    // Trigger end early after hold duration
    holdTimerRef.current = setTimeout(() => {
      setIsHoldingEnd(false);
      holdProgressAnim.setValue(0);
      onEndEarly();
    }, LONG_PRESS_DURATION);
  };

  const cancelHold = () => {
    setIsHoldingEnd(false);
    holdProgressAnim.setValue(0);
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (holdAnimRef.current) {
      holdAnimRef.current.stop();
      holdAnimRef.current = null;
    }
  };

  const holdFillWidth = holdProgressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

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

      {/* End early — requires long press */}
      <Pressable
        style={({ pressed }) => [
          styles.endButton,
          isHoldingEnd && styles.endButtonHolding,
        ]}
        onPressIn={startHold}
        onPressOut={cancelHold}
      >
        {/* Animated fill background */}
        {isHoldingEnd && (
          <Animated.View
            style={[
              styles.endButtonFill,
              { width: holdFillWidth as any },
            ]}
          />
        )}
        <Ionicons name="stop" size={18} color={colors.danger} />
        <Text style={styles.endButtonText}>
          {isHoldingEnd ? 'Hold...' : 'Hold to End'}
        </Text>
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
    backgroundColor: 'rgba(244,63,94,0.08)',
    paddingVertical: 18,
    borderRadius: 30,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.3)',
    overflow: 'hidden',
    position: 'relative',
  },
  endButtonHolding: {
    borderColor: colors.danger,
  },
  endButtonFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: 'rgba(244,63,94,0.15)',
    borderRadius: 30,
  },
  endButtonText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.danger,
    zIndex: 1,
  },
});
