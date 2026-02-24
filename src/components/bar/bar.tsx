import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { colors } from "../../theme";

interface CircularProgressProps {
  size?: number;
  strokeWidth?: number;
  progress: number; // 0 – 100
}

const CircularProgress = ({
  size = 120,
  strokeWidth = 10,
  progress,
}: CircularProgressProps) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const strokeDashoffset = circumference - (circumference * progress) / 100;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {/* Background Circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#ffffff22"
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Progress Circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.primary}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          originX={size / 2}
          originY={size / 2}
        />
      </Svg>

      {/* CENTER PERCENTAGE TEXT */}
      <View style={styles.center}>
        <Text style={styles.percent}>{Math.round(progress)}%</Text>
      </View>
    </View>
  );
};

export default CircularProgress;

const styles = StyleSheet.create({
  center: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  percent: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.primary,
  },
});
