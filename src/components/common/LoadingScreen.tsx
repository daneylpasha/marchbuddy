import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../../theme';

interface LoadingScreenProps {
  message?: string;
  submessage?: string;
}

export default function LoadingScreen({ message, submessage }: LoadingScreenProps) {
  const spinValue = useRef(new Animated.Value(0)).current;
  const pulseValue = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseValue, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseValue, {
          toValue: 0.6,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const rotation = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.spinner, { transform: [{ rotate: rotation }], opacity: pulseValue }]}>
        <View style={styles.spinnerDot} />
      </Animated.View>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {submessage ? <Text style={styles.submessage}>{submessage}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
  },
  spinner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: colors.primaryDim,
    borderTopColor: colors.primary,
  },
  spinnerDot: {
    position: 'absolute',
    top: -3,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  message: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
    marginTop: 8,
    letterSpacing: 0.3,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  submessage: {
    color: colors.textSecondary,
    fontSize: 14,
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
