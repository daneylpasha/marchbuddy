import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "../../theme";
import CircularProgress from "../bar/bar";

interface ProgressRingProps {
  current: number;
  total: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
  customCenter?: React.ReactNode;
}

export default function ProgressRing({
  current,
  total,
  size = 100,
  strokeWidth = 8,
  color = colors.primary,
  label,
  customCenter,
}: ProgressRingProps) {
  // Normal progress: 0% → 100% as calories are consumed
  const progressPercent = total > 0 ? Math.min((current / total) * 100, 100) : 0;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <CircularProgress size={size} strokeWidth={strokeWidth} progress={progressPercent} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  ring: {
    position: "absolute",
  },
  halfClip: {
    position: "absolute",
    top: 0,
    overflow: "hidden",
  },
  halfCircle: {
    position: "absolute",
    top: 0,
    borderRightColor: "transparent",
    borderBottomColor: "transparent",
  },
  center: {
    backgroundColor: colors.surfaceElevated,
    justifyContent: "center",
    alignItems: "center",
  },
  valueText: {
    color: colors.textPrimary,
    fontWeight: "700",
    fontFamily: fonts.bold,
    letterSpacing: 0.3,
    fontVariant: ["tabular-nums"],
  },
  labelText: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
    marginTop: 1,
  },
});
