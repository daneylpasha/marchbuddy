import React, { useEffect, useState } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CONFETTI_COUNT = 48;

interface ConfettiPiece {
  x: Animated.Value;
  y: Animated.Value;
  rotation: Animated.Value;
  color: string;
  size: number;
  initialX: number;
}

interface ConfettiAnimationProps {
  colors: string[];
}

// Create pieces at module import time to avoid empty-on-first-render issue
function createPieces(colors: string[]): ConfettiPiece[] {
  return Array.from({ length: CONFETTI_COUNT }, () => {
    const x = Math.random() * SCREEN_WIDTH;
    return {
      x: new Animated.Value(x),
      y: new Animated.Value(-20 - Math.random() * 80),
      rotation: new Animated.Value(0),
      initialX: x,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 8 + 5,
    };
  });
}

export const ConfettiAnimation: React.FC<ConfettiAnimationProps> = ({ colors }) => {
  // useState with initializer ensures pieces exist on first render
  const [pieces] = useState<ConfettiPiece[]>(() => createPieces(colors));

  useEffect(() => {
    const animations = pieces.map((piece) => {
      const delay = Math.random() * 600;
      const duration = 2200 + Math.random() * 1200;
      const driftX = piece.initialX + (Math.random() - 0.5) * 180;
      const rotations = (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 8 + 4);

      return Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(piece.y, {
            toValue: SCREEN_HEIGHT + 30,
            duration,
            useNativeDriver: true,
          }),
          Animated.timing(piece.x, {
            toValue: driftX,
            duration,
            useNativeDriver: true,
          }),
          Animated.timing(piece.rotation, {
            toValue: rotations,
            duration,
            useNativeDriver: true,
          }),
        ]),
      ]);
    });

    Animated.parallel(animations).start();
  }, [pieces]);

  return (
    <View style={styles.container} pointerEvents="none">
      {pieces.map((piece, index) => (
        <Animated.View
          key={index}
          style={[
            styles.piece,
            {
              backgroundColor: piece.color,
              width: piece.size,
              height: piece.size * 1.6,
              transform: [
                { translateX: piece.x },
                { translateY: piece.y },
                {
                  rotate: piece.rotation.interpolate({
                    inputRange: [-10, 10],
                    outputRange: ['-360deg', '360deg'],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  piece: {
    position: 'absolute',
    borderRadius: 2,
    top: 0,
    left: 0,
  },
});
