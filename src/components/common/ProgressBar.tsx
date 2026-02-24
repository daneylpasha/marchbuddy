import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type ViewStyle } from 'react-native';
import { colors } from '../../theme';

interface ProgressBarProps {
  current: number;
  total: number;
  color?: string;
  height?: number;
  style?: ViewStyle;
}

export default function ProgressBar({
  current,
  total,
  color = colors.primary,
  height = 8,
  style,
}: ProgressBarProps) {
  const progress = total > 0 ? Math.min(current / total, 1) : 0;

  const animWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animWidth, {
      toValue: progress * 100,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const widthInterp = animWidth.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }, style]}>
      <Animated.View style={[styles.fill, { width: widthInterp, backgroundColor: color, borderRadius: height / 2 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: colors.dotInactive,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});
