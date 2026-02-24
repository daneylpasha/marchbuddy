import React, { useEffect, useCallback, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useKeepAwake } from "expo-keep-awake";

import { useActiveSessionStore } from "../../store/activeSessionStore";
import { useSessionStore } from "../../store/sessionStore";
import { useSessionTimer } from "../../hooks/useSessionTimer";
import { locationService } from "../../services/locationService";
import { sessionCueService } from "../../services/sessionCueService";

import { Ionicons } from "@expo/vector-icons";
import { CurrentSegmentDisplay } from "./components/CurrentSegmentDisplay";
import { SessionTimer } from "./components/SessionTimer";
import { NextSegmentPreview } from "./components/NextSegmentPreview";
import { SessionStatsBar } from "./components/SessionStatsBar";
import { SessionControls } from "./components/SessionControls";

import { colors, fonts } from "../../theme";
import type { RunStackParamList } from "../../navigation/RunNavigator";

type ActiveSessionNavProp = NativeStackNavigationProp<
  RunStackParamList,
  "ActiveSession"
>;

interface Props {
  navigation: ActiveSessionNavProp;
}

// ─── Confirm overlay (absolute — works on native stack) ───────────────────────

interface ConfirmOverlayProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmOverlay({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmOverlayProps) {
  if (!visible) return null;
  return (
    <View style={overlayStyles.root} pointerEvents="box-none">
      <Pressable style={overlayStyles.backdrop} onPress={onCancel} />
      <View style={overlayStyles.card}>
        <Text style={overlayStyles.title}>{title}</Text>
        <Text style={overlayStyles.message}>{message}</Text>
        <View style={overlayStyles.btnRow}>
          <Pressable
            style={({ pressed }) => [
              overlayStyles.btn,
              overlayStyles.cancelBtn,
              pressed && { opacity: 0.7 },
            ]}
            onPress={onCancel}
          >
            <Text style={overlayStyles.cancelLabel}>{cancelLabel}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              overlayStyles.btn,
              overlayStyles.confirmBtn,
              pressed && { opacity: 0.8 },
            ]}
            onPress={onConfirm}
          >
            <Text style={overlayStyles.confirmLabel}>{confirmLabel}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const overlayStyles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.78)",
  },
  card: {
    width: "100%",
    backgroundColor: "#1A1A1A",
    borderRadius: 20,
    paddingTop: 28,
    paddingHorizontal: 24,
    paddingBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    zIndex: 1001,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.textPrimary,
    letterSpacing: 0.3,
    textAlign: "center",
    marginBottom: 10,
  },
  message: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 24,
    letterSpacing: 0.2,
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  cancelBtn: {
    backgroundColor: "#2A2A2A",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  confirmBtn: {
    backgroundColor: colors.danger,
  },
  cancelLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },
  confirmLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: "#fff",
    letterSpacing: 0.3,
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ActiveSessionScreen({ navigation }: Props) {
  useKeepAwake();

  const { selectedPlan } = useSessionStore();
  const {
    plan,
    isActive,
    isPaused,
    currentSegmentIndex,
    distanceKm,
    startSession,
    pauseSession,
    resumeSession,
    addRoutePoint,
    endSession,
    resetSession,
  } = useActiveSessionStore();

  const sessionCompletedRef = useRef(false);
  const isActiveRef = useRef(false);
  const pendingBackAction = useRef<any>(null);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  const handleSessionComplete = useCallback(() => {
    if (sessionCompletedRef.current) return;
    sessionCompletedRef.current = true;
    locationService.stopTracking();
    const completed = endSession();
    isActiveRef.current = false; // stop beforeRemove from blocking auto-complete nav
    if (completed) {
      navigation.replace("PostSession", { session: completed });
    } else {
      navigation.goBack();
    }
  }, [endSession, navigation]);

  const {
    totalElapsedSeconds,
    segmentRemainingSeconds,
    currentSegment,
    nextSegment,
    progress,
  } = useSessionTimer({ onComplete: handleSessionComplete });

  const [locationPermissionDenied, setLocationPermissionDenied] =
    useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [leaveModalVisible, setLeaveModalVisible] = useState(false);
  const [endEarlyModalVisible, setEndEarlyModalVisible] = useState(false);

  // ── Initialize ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedPlan) {
      navigation.goBack();
      return;
    }

    let mounted = true;

    (async () => {
      const hasPermission = await locationService.requestPermissions();
      if (!mounted) return;

      if (!hasPermission) {
        setLocationPermissionDenied(true);
      } else {
        await locationService.startTracking((point) => {
          addRoutePoint(point);
        });
      }

      startSession(selectedPlan);
      sessionCueService.playSegmentChange(selectedPlan.segments[0].type);
      setIsInitializing(false);
    })();

    return () => {
      mounted = false;
      locationService.stopTracking();
      sessionCueService.reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-complete when last segment finishes ────────────────────────────────
  useEffect(() => {
    if (!plan || !isActive) return;
    if (currentSegmentIndex >= plan.segments.length) {
      handleSessionComplete();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSegmentIndex, plan, isActive]);

  // ── Block back during active session ───────────────────────────────────────
  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (!isActiveRef.current) return;
      e.preventDefault();
      pendingBackAction.current = e.data.action;
      setLeaveModalVisible(true);
    });
    return unsubscribe;
  }, [navigation]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handlePauseResume = useCallback(() => {
    if (isPaused) {
      resumeSession();
      sessionCueService.playResume();
    } else {
      pauseSession();
      sessionCueService.playPause();
    }
  }, [isPaused, pauseSession, resumeSession]);

  const handleEndEarly = useCallback(() => {
    setEndEarlyModalVisible(true);
  }, []);

  const confirmLeave = useCallback(() => {
    setLeaveModalVisible(false);
    locationService.stopTracking();
    isActiveRef.current = false;
    resetSession();
    if (pendingBackAction.current) {
      navigation.dispatch(pendingBackAction.current);
    }
  }, [navigation, resetSession]);

  const confirmEndEarly = useCallback(() => {
    setEndEarlyModalVisible(false);
    locationService.stopTracking();
    isActiveRef.current = false;
    if (totalElapsedSeconds < 30) {
      resetSession();
      navigation.goBack();
      return;
    }
    const completed = endSession();
    if (completed) {
      navigation.replace("PostSession", { session: completed });
    } else {
      navigation.goBack();
    }
  }, [endSession, resetSession, navigation, totalElapsedSeconds]);

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (isInitializing || !plan || !currentSegment) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Starting session...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <StatusBar barStyle="light-content" />

        <View style={styles.topBar}>
          <Pressable
            style={({ pressed }) => [
              styles.backBtn,
              pressed && { opacity: 0.6 },
            ]}
            onPress={() => navigation.goBack()}
            hitSlop={12}
          >
            <Ionicons name="close" size={24} color="rgba(255,255,255,0.6)" />
          </Pressable>
        </View>

        <View style={styles.timerSection}>
          <SessionTimer
            totalElapsedSeconds={totalElapsedSeconds}
            isPaused={isPaused}
          />
        </View>

        <View style={styles.segmentSection}>
          <CurrentSegmentDisplay
            segment={currentSegment}
            remainingSeconds={segmentRemainingSeconds}
            progress={progress}
            isPaused={isPaused}
          />
        </View>

        {nextSegment && (
          <View style={styles.nextSection}>
            <NextSegmentPreview segment={nextSegment} />
          </View>
        )}

        <View style={styles.statsSection}>
          <SessionStatsBar
            distanceKm={distanceKm}
            totalElapsedSeconds={totalElapsedSeconds}
            currentSegmentIndex={currentSegmentIndex}
            totalSegments={plan.segments.length}
            locationPermissionDenied={locationPermissionDenied}
          />
        </View>

        <View style={styles.controlsSection}>
          <SessionControls
            isPaused={isPaused}
            onPauseResume={handlePauseResume}
            onEndEarly={handleEndEarly}
          />
        </View>
      </SafeAreaView>

      {/* Overlays sit on the root View — above SafeAreaView, above everything */}
      <ConfirmOverlay
        visible={leaveModalVisible}
        title="Leave Session?"
        message="Your session is still in progress. End it now?"
        cancelLabel="Stay"
        confirmLabel="End & Leave"
        onCancel={() => setLeaveModalVisible(false)}
        onConfirm={confirmLeave}
      />

      <ConfirmOverlay
        visible={endEarlyModalVisible}
        title="End Session Early?"
        message="Your progress so far will be saved."
        cancelLabel="Keep Going"
        confirmLabel="End Session"
        onCancel={() => setEndEarlyModalVisible(false)}
        onConfirm={confirmEndEarly}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  loadingText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: fonts.medium,
  },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
    alignItems: "flex-start",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    justifyContent: "center",
  },
  timerSection: {
    paddingTop: 8,
    alignItems: "center",
  },
  segmentSection: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  nextSection: {
    paddingHorizontal: 24,
    paddingBottom: 14,
  },
  statsSection: {
    paddingHorizontal: 24,
    paddingBottom: 14,
  },
  controlsSection: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
});
