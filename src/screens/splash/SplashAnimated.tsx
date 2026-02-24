import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { fonts } from "../../theme";

interface Props {
  hiding: boolean;
  onHidden: () => void;
}

export default function SplashAnimated({ hiding, onHidden }: Props) {
  const containerOpacity = useRef(new Animated.Value(1)).current;
  const textOpacity = useRef(new Animated.Value(0.3)).current;
  const didFadeOut = useRef(false);

  useEffect(() => {
    Animated.timing(textOpacity, {
      toValue: 1,
      duration: 800,
      delay: 200,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (hiding && !didFadeOut.current) {
      didFadeOut.current = true;
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }).start(() => onHidden());
    }
  }, [hiding]);

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]}>
      <LinearGradient
        colors={["transparent", "transparent", "#1a1a1a", "#212020"]}
        locations={[0, 0.6, 0.85, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[styles.content, { opacity: textOpacity }]}>
        <Animated.Text style={styles.march}>MARCH</Animated.Text>
        <Animated.Text style={styles.buddy}>BUDDY</Animated.Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
  },
  march: {
    fontFamily: fonts.titleRegular,
    fontSize: 80,
    color: "#FFFFFF",
    letterSpacing: -2,
    lineHeight: 80,
    includeFontPadding: false,
  },
  buddy: {
    fontFamily: fonts.titleRegular,
    fontSize: 80,
    color: "#FFFFFF",
    letterSpacing: 0,
    lineHeight: 80,
    marginTop: -22,
    includeFontPadding: false,
  },
});
