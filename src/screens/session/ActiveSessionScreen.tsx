import React, { useEffect, useCallback, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Pressable,
  Animated,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useKeepAwake } from "expo-keep-awake";
import * as Haptics from "expo-haptics";

import {
  useActiveSessionStore,
  getSessionReferenceTime,
} from "../../store/activeSessionStore";
import { useSessionStore } from "../../store/sessionStore";
import { useSessionTimer } from "../../hooks/useSessionTimer";
import { locationService } from "../../services/locationService";
import { pedometerService } from "../../services/pedometerService";
import { sessionCueService } from "../../services/sessionCueService";

import { Ionicons } from "@expo/vector-icons";
import { CurrentSegmentDisplay } from "./components/CurrentSegmentDisplay";
import { SessionTimer } from "./components/SessionTimer";
import { NextSegmentPreview } from "./components/NextSegmentPreview";
import { SessionStatsBar } from "./components/SessionStatsBar";
import { SessionControls } from "./components/SessionControls";

import { colors, fonts } from "../../theme";
import type { RunStackParamList } from "../../navigation/RunNavigator";

type Props = NativeStackScreenProps<RunStackParamList, "ActiveSession">;

// ─── Confirm overlay (absolute — works on native stack) ───────────────────────

interface ConfirmOverlayProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  // 'neutral' (default) — gray cancel button.
  // 'primary' — green cancel button, used when the cancel action is the
  // recommended path (e.g. "Resume" on the cold-start prompt).
  cancelTone?: "neutral" | "primary";
}

function ConfirmOverlay({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  cancelTone = "neutral",
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
              cancelTone === "primary"
                ? overlayStyles.cancelBtnPrimary
                : overlayStyles.cancelBtn,
              pressed && { opacity: 0.8 },
            ]}
            onPress={onCancel}
          >
            <Text
              style={
                cancelTone === "primary"
                  ? overlayStyles.cancelLabelPrimary
                  : overlayStyles.cancelLabel
              }
            >
              {cancelLabel}
            </Text>
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
  cancelBtnPrimary: {
    backgroundColor: colors.primary,
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
  cancelLabelPrimary: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: "#fff",
    letterSpacing: 0.3,
  },
  confirmLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: "#fff",
    letterSpacing: 0.3,
  },
});

// ─── Segment colors and messages ──────────────────────────────────────────────

const segmentColors = {
  warmup: colors.segmentWarmup,
  walk: colors.segmentWalk,
  run: colors.segmentRun,
  cooldown: colors.segmentCooldown,
};

const SEGMENT_MESSAGES: Record<string, string[]> = {
  warmup: ["Warming up...", "Easy does it"],
  walk: ["Nice pace!", "Recover and breathe", "Walking strong"],
  run: ["Let's go!", "You've got this!", "Push through!"],
  cooldown: ["Almost done!", "Great work!", "Cool it down"],
};

// Solid accent colors for the cue pill dot — vibrant siblings of the
// faint segment background colors so the dot reads at a glance.
const CUE_DOT_COLORS = {
  warmup: '#F59E0B',
  walk: '#38BDF8',
  run: '#10B981',
  cooldown: '#A78BFA',
} as const;

// Used in the cold-start "Resume your session?" prompt so the user has a
// concrete sense of how recent the saved session is before deciding.
function formatSessionAge(ageMs: number): string {
  if (ageMs < 60_000) return "moments ago";
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"} ago`;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ActiveSessionScreen({ navigation, route }: Props) {
  useKeepAwake();

  const { height: screenHeight } = useWindowDimensions();
  // Widened threshold: many "medium" Android phones (~720–800 logical px)
  // still couldn't fit the default sizing without the progress bar
  // touching the NEXT UP card.
  const isShort = screenHeight < 800;

  const { selectedPlan } = useSessionStore();
  const {
    plan,
    isActive,
    isPaused,
    currentSegmentIndex,
    distanceKm,
    stepCount,
    startSession,
    pauseSession,
    resumeSession,
    addRoutePoint,
    setStepCount,
    endSession,
    resetSession,
  } = useActiveSessionStore();

  const sessionCompletedRef = useRef(false);
  const isActiveRef = useRef(false);
  const pendingBackAction = useRef<any>(null);

  // Animation refs for background color transition
  const bgColorAnim = useRef(new Animated.Value(0)).current;
  const transitionOpacityAnim = useRef(new Animated.Value(0)).current;
  // Slide ref for the top-pill cue (shared by segment + halfway messages)
  const transitionSlideAnim = useRef(new Animated.Value(-40)).current;
  const halfwayOpacityAnim = useRef(new Animated.Value(0)).current;
  const halfwaySlideAnim = useRef(new Animated.Value(-40)).current;

  // Tracking state for halfway celebration
  const halfwayShownRef = useRef(false);

  // GPS warm-up state — chip stays visible until we get a usable fix
  // (≤25m accuracy) or 30s pass, whichever comes first.
  const [gpsAcquired, setGpsAcquired] = useState(false);
  const gpsAcquiredRef = useRef(false);
  const gpsDotPulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  // On cold-start resume the navigator's stack root IS this screen, so
  // navigation.goBack() finds nothing above and React Navigation logs a
  // "GO_BACK was not handled" warning (and on production silently does
  // nothing — leaving the user stuck). Fall through to Today when there's
  // no parent to pop back to.
  const exitToToday = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.replace("Today");
    }
  }, [navigation]);

  const handleSessionComplete = useCallback(() => {
    if (sessionCompletedRef.current) return;
    sessionCompletedRef.current = true;
    locationService.stopTracking();
    pedometerService.stopTracking();
    const completed = endSession();
    isActiveRef.current = false; // stop beforeRemove from blocking auto-complete nav
    if (completed) {
      navigation.replace("PostSession", { session: completed });
    } else {
      exitToToday();
    }
  }, [endSession, navigation, exitToToday]);

  const {
    totalElapsedSeconds,
    segmentRemainingSeconds,
    currentSegment,
    nextSegment,
    progress,
  } = useSessionTimer({ onComplete: handleSessionComplete });

  const [locationPermissionDenied, setLocationPermissionDenied] =
    useState(false);
  const [pedometerAvailable, setPedometerAvailable] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [leaveModalVisible, setLeaveModalVisible] = useState(false);
  const [endEarlyModalVisible, setEndEarlyModalVisible] = useState(false);
  const [segmentTransitionMessage, setSegmentTransitionMessage] = useState<string | null>(null);
  const [transitionSegmentType, setTransitionSegmentType] = useState<keyof typeof CUE_DOT_COLORS>('warmup');
  const [showHalfwayMessage, setShowHalfwayMessage] = useState(false);
  const [resumePromptVisible, setResumePromptVisible] = useState(false);
  const [resumePromptAge, setResumePromptAge] = useState('');

  // ── Initialize ──────────────────────────────────────────────────────────────
  useEffect(() => {
    // Cold-start resume path: if the persisted store already has an active
    // session (paused or running), we re-hook tracking but must NOT call
    // startSession — that would reset the timestamps and wipe progress.
    // selectedPlan from useSessionStore is in-memory only and won't survive
    // a process kill, so for the resume case we rely entirely on `plan` from
    // the persisted activeSessionStore.
    const isResuming = isActive && plan != null;

    if (!isResuming && !selectedPlan) {
      navigation.goBack();
      return;
    }

    let mounted = true;

    // For resume, the environment is already persisted in the store.
    // For a fresh start, it comes from the route param.
    const environment = isResuming
      ? (useActiveSessionStore.getState().environment ?? 'outdoor')
      : route.params.environment;
    const isOutdoor = environment === 'outdoor';

    (async () => {
      // Configure audio session for background speech + music ducking
      await sessionCueService.initialize();

      if (isOutdoor) {
        const hasPermission = await locationService.requestPermissions();
        if (!mounted) return;

        if (!hasPermission) {
          setLocationPermissionDenied(true);
        } else {
          await locationService.startTracking((point) => {
            addRoutePoint(point);
            // First usable fix dismisses the warm-up chip. Use a ref so we
            // don't keep re-firing setState on every subsequent point.
            if (
              !gpsAcquiredRef.current &&
              point.accuracy != null &&
              point.accuracy <= 25
            ) {
              gpsAcquiredRef.current = true;
              setGpsAcquired(true);
            }
          });
        }
      } else {
        // Indoor session — GPS not needed, mark as acquired so the chip never shows.
        gpsAcquiredRef.current = true;
        setGpsAcquired(true);
      }

      if (!mounted) return;

      // Pedometer is independent of GPS — works indoors / treadmill / phone
      // in pocket. Failure is silent: stepCount stays 0 and the UI hides.
      // On resume we hand the persisted stepCount in as a baseline so the
      // newly-restarted native subscription (which counts from 0) is added
      // to the previous total instead of replacing it.
      const stepBaseline = isResuming ? stepCount : 0;
      const pedoPermission = await pedometerService.requestPermissions();
      if (mounted && pedoPermission) {
        const started = await pedometerService.startTracking((steps) => {
          setStepCount(steps);
        }, stepBaseline);
        if (started) setPedometerAvailable(true);
      }

      if (!isResuming) {
        startSession(selectedPlan!, environment);
        sessionCueService.playSegmentChange(selectedPlan!.segments[0].type);
      }
      // On resume the session is already in the correct state (paused or
      // running) — we just unblock the loading screen and let the existing
      // pause/resume controls take over from here.
      setIsInitializing(false);
    })();

    return () => {
      mounted = false;
      locationService.stopTracking();
      pedometerService.stopTracking();
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

  // ── GPS warm-up: force-dismiss after 30s + pulse the indicator dot ──────────
  useEffect(() => {
    if (gpsAcquired || locationPermissionDenied || !isActive) return;

    const fallback = setTimeout(() => {
      gpsAcquiredRef.current = true;
      setGpsAcquired(true);
    }, 30000);

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(gpsDotPulse, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(gpsDotPulse, {
          toValue: 0.4,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();

    return () => {
      clearTimeout(fallback);
      loop.stop();
    };
  }, [gpsAcquired, locationPermissionDenied, isActive, gpsDotPulse]);

  const showGpsChip =
    isActive && !locationPermissionDenied && !gpsAcquired;

  // ── Handle segment transitions (message + background color animation) ────────
  useEffect(() => {
    if (!plan || currentSegmentIndex >= plan.segments.length) return;

    const currentSeg = plan.segments[currentSegmentIndex];
    const segmentType = currentSeg.type as keyof typeof SEGMENT_MESSAGES;

    // Show transition message — slim top pill that slides in/out
    const messages = SEGMENT_MESSAGES[segmentType];
    if (messages && messages.length > 0) {
      const randomMsg = messages[Math.floor(Math.random() * messages.length)];
      setSegmentTransitionMessage(randomMsg);
      setTransitionSegmentType(segmentType as keyof typeof CUE_DOT_COLORS);

      transitionSlideAnim.setValue(-40);
      transitionOpacityAnim.setValue(0);

      Animated.sequence([
        Animated.parallel([
          Animated.timing(transitionSlideAnim, {
            toValue: 0,
            duration: 220,
            useNativeDriver: true,
          }),
          Animated.timing(transitionOpacityAnim, {
            toValue: 1,
            duration: 220,
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(1500),
        Animated.parallel([
          Animated.timing(transitionSlideAnim, {
            toValue: -40,
            duration: 220,
            useNativeDriver: true,
          }),
          Animated.timing(transitionOpacityAnim, {
            toValue: 0,
            duration: 220,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        setSegmentTransitionMessage(null);
      });
    }

    // Animate background color transition (400ms)
    Animated.timing(bgColorAnim, {
      toValue: currentSegmentIndex,
      duration: 400,
      useNativeDriver: false,
    }).start();

    // Check for halfway celebration — also a top pill, primary accent
    if (plan.segments.length > 0) {
      const halfway = Math.floor(plan.segments.length / 2);
      if (currentSegmentIndex >= halfway && !halfwayShownRef.current) {
        halfwayShownRef.current = true;
        setShowHalfwayMessage(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        sessionCueService.playHalfway();

        halfwaySlideAnim.setValue(-40);
        halfwayOpacityAnim.setValue(0);

        Animated.sequence([
          Animated.parallel([
            Animated.timing(halfwaySlideAnim, {
              toValue: 0,
              duration: 240,
              useNativeDriver: true,
            }),
            Animated.timing(halfwayOpacityAnim, {
              toValue: 1,
              duration: 240,
              useNativeDriver: true,
            }),
          ]),
          Animated.delay(1800),
          Animated.parallel([
            Animated.timing(halfwaySlideAnim, {
              toValue: -40,
              duration: 240,
              useNativeDriver: true,
            }),
            Animated.timing(halfwayOpacityAnim, {
              toValue: 0,
              duration: 240,
              useNativeDriver: true,
            }),
          ]),
        ]).start(() => {
          setShowHalfwayMessage(false);
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSegmentIndex, plan]);

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

  // ── Cold-start resume prompt ───────────────────────────────────────────────
  // When the user lands here directly because a persisted session
  // re-hydrated (vs reaching this screen via in-app navigation), explicitly
  // confirm whether they want to continue or scrap it. We detect the case
  // by checking that useSessionStore.selectedPlan is empty — that store
  // is in-memory only, so its emptiness is a reliable cold-start signal.
  const promptShownRef = useRef(false);
  useEffect(() => {
    if (promptShownRef.current) return;
    if (!isActive || !plan) return;
    if (selectedPlan) return; // came here via normal in-app navigation
    promptShownRef.current = true;

    const state = useActiveSessionStore.getState();
    const ref = getSessionReferenceTime(state);
    const ageMs = ref ? Date.now() - ref.getTime() : 0;
    setResumePromptAge(formatSessionAge(ageMs));
    setResumePromptVisible(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Resume from cold-start prompt — close the modal AND actually unpause
  // the session. Without the resumeSession() call the user lands on a
  // frozen paused state and has to tap the Pause/Resume button separately,
  // which is confusing because they already chose "Resume" once.
  // resumeSession() bails out on its own if not paused, so calling it
  // unconditionally is safe even in the rare crash-mid-run cold-start case.
  const dismissResumePrompt = useCallback(() => {
    setResumePromptVisible(false);
    if (useActiveSessionStore.getState().isPaused) {
      resumeSession();
      sessionCueService.playResume();
    }
  }, [resumeSession]);

  // Discard from cold-start prompt — wipe persisted state and route to
  // Today. Use replace so the back-stack doesn't keep a dead ActiveSession
  // entry to navigate back into.
  const confirmStartOver = useCallback(() => {
    setResumePromptVisible(false);
    locationService.stopTracking();
    pedometerService.stopTracking();
    isActiveRef.current = false;
    resetSession();
    navigation.replace("Today");
  }, [navigation, resetSession]);

  const confirmLeave = useCallback(() => {
    setLeaveModalVisible(false);
    locationService.stopTracking();
    pedometerService.stopTracking();
    isActiveRef.current = false;
    resetSession();
    // Replay the original back action if there's still a parent to go back
    // to. On cold-start resume there's no parent, so dispatching the saved
    // GO_BACK would silently fail — fall through to Today instead.
    if (pendingBackAction.current && navigation.canGoBack()) {
      navigation.dispatch(pendingBackAction.current);
    } else {
      navigation.replace("Today");
    }
  }, [navigation, resetSession]);

  const confirmEndEarly = useCallback(() => {
    setEndEarlyModalVisible(false);
    locationService.stopTracking();
    pedometerService.stopTracking();
    isActiveRef.current = false;
    if (totalElapsedSeconds < 30) {
      resetSession();
      exitToToday();
      return;
    }
    const completed = endSession();
    if (completed) {
      navigation.replace("PostSession", { session: completed });
    } else {
      exitToToday();
    }
  }, [endSession, resetSession, navigation, totalElapsedSeconds, exitToToday]);

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

  // Get current segment for background color
  const getCurrentSegmentColor = (): string => {
    if (!plan || currentSegmentIndex >= plan.segments.length) {
      return colors.background;
    }
    const segmentType = plan.segments[currentSegmentIndex].type as keyof typeof segmentColors;
    return segmentColors[segmentType] || colors.background;
  };

  // Build interpolated background color
  const segmentOutputColors = plan
    ? plan.segments.map((seg) => {
        const type = seg.type as keyof typeof segmentColors;
        return segmentColors[type] || colors.background;
      })
    : [colors.background, colors.background];

  const segmentInputRange =
    segmentOutputColors.length <= 1
      ? [0, 1]
      : segmentOutputColors.map((_, i) => i);

  // Ensure both arrays always match in length
  const bgColor = bgColorAnim.interpolate({
    inputRange: segmentInputRange,
    outputRange: segmentOutputColors,
    extrapolate: "clamp",
  });

  return (
    <Animated.View
      style={[
        styles.root,
        {
          backgroundColor: bgColor as any,
        },
      ]}
    >
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <StatusBar barStyle="light-content" />

        <View style={styles.topBar}>
          <Pressable
            style={({ pressed }) => [
              styles.backBtn,
              pressed && { opacity: 0.6 },
            ]}
            onPress={() => setLeaveModalVisible(true)}
            hitSlop={12}
          >
            <Ionicons name="close" size={24} color="rgba(255,255,255,0.6)" />
          </Pressable>

          {showGpsChip && (
            <View style={styles.gpsChip} pointerEvents="none">
              <Animated.View
                style={[styles.gpsDot, { opacity: gpsDotPulse }]}
              />
              <Text style={styles.gpsChipText}>Acquiring GPS…</Text>
            </View>
          )}
        </View>

        <View style={[styles.timerSection, isShort && styles.timerSectionShort]}>
          <SessionTimer
            totalElapsedSeconds={totalElapsedSeconds}
            isPaused={isPaused}
          />
        </View>

        <View style={styles.segmentSection}>
          <CurrentSegmentDisplay
            segment={currentSegment}
            remainingSeconds={segmentRemainingSeconds}
            isPaused={isPaused}
          />
        </View>

        <View style={[styles.nextSection, isShort && styles.tightSection]}>
          <NextSegmentPreview
            progress={progress}
            progressColor={
              currentSegment.type === "run" ? colors.primary : "#fff"
            }
            segment={nextSegment ?? null}
          />
        </View>

        <View style={[styles.statsSection, isShort && styles.tightSection]}>
          <SessionStatsBar
            distanceKm={distanceKm}
            totalElapsedSeconds={totalElapsedSeconds}
            currentSegmentIndex={currentSegmentIndex}
            totalSegments={plan.segments.length}
            locationPermissionDenied={locationPermissionDenied}
            stepCount={stepCount}
            pedometerAvailable={pedometerAvailable}
          />
        </View>

        <View style={[styles.controlsSection, isShort && styles.controlsSectionShort]}>
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

      <ConfirmOverlay
        visible={resumePromptVisible}
        title="Resume Your Session?"
        message={`We saved your session from ${resumePromptAge}. You can pick up where you left off, or start fresh.`}
        cancelLabel="Resume"
        confirmLabel="Start Over"
        cancelTone="primary"
        onCancel={dismissResumePrompt}
        onConfirm={confirmStartOver}
      />

      {/* Segment transition pill — slides in from top, no backdrop */}
      {segmentTransitionMessage && (
        <Animated.View
          style={[
            styles.cueTopWrap,
            {
              opacity: transitionOpacityAnim,
              transform: [{ translateY: transitionSlideAnim }],
            },
          ]}
          pointerEvents="none"
        >
          <View style={styles.cuePill}>
            <View
              style={[
                styles.cueDot,
                { backgroundColor: CUE_DOT_COLORS[transitionSegmentType] },
              ]}
            />
            <Text style={styles.cuePillText} numberOfLines={1}>
              {segmentTransitionMessage}
            </Text>
          </View>
        </Animated.View>
      )}

      {/* Halfway celebration pill — same shape, primary accent */}
      {showHalfwayMessage && (
        <Animated.View
          style={[
            styles.cueTopWrap,
            {
              opacity: halfwayOpacityAnim,
              transform: [{ translateY: halfwaySlideAnim }],
            },
          ]}
          pointerEvents="none"
        >
          <View style={[styles.cuePill, styles.cuePillAccent]}>
            <View style={[styles.cueDot, { backgroundColor: colors.primary }]} />
            <Text style={styles.cuePillText} numberOfLines={1}>
              Halfway there — keep pushing
            </Text>
          </View>
        </Animated.View>
      )}
    </Animated.View>
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
    flexDirection: "row",
    alignItems: "center",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    justifyContent: "center",
  },
  gpsChip: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  gpsDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#FFB020",
    marginRight: 8,
  },
  gpsChipText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.textSecondary,
    letterSpacing: 0.4,
  },
  timerSection: {
    paddingTop: 8,
    paddingBottom: 24,
    alignItems: "center",
  },
  timerSectionShort: {
    paddingTop: 2,
    paddingBottom: 8,
  },
  segmentSection: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    // 14px gap between progress card and NEXT UP card — matches the
    // 14px gap between NEXT UP and stats card for visual rhythm.
    paddingBottom: 14,
    // Defensive: on very small phones the inner content can be taller
    // than the available flex slot, which causes the guidance text to
    // bleed onto the NEXT UP progress bar. Clip it.
    overflow: "hidden",
  },
  nextSection: {
    paddingHorizontal: 24,
    paddingBottom: 14,
  },
  statsSection: {
    paddingHorizontal: 24,
    paddingBottom: 14,
  },
  tightSection: {
    paddingBottom: 8,
  },
  controlsSection: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  controlsSectionShort: {
    paddingBottom: 4,
  },
  // ── Cue pill (segment transition + halfway) ──
  // Slim top notification — slides down from the safe area, no backdrop
  // dim. Replaces the previous full-screen modal-style overlay so the
  // workout content stays visible during transitions.
  cueTopWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: 64,
    zIndex: 100,
  },
  cuePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(20,20,20,0.94)',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    maxWidth: '85%',
  },
  cuePillAccent: {
    borderColor: 'rgba(16,185,129,0.45)',
  },
  cueDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cuePillText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: '#fff',
    letterSpacing: 0.2,
    flexShrink: 1,
  },
});
