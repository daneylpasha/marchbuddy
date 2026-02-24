import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, spacing, touchTarget } from "../../theme";
import {
  useCoachSetupStore,
  type ActivityLevel,
  type TimePreference,
  type PastAttempts,
  type ObstacleId,
} from "../../store/coachSetupStore";
import {
  detectTriggerTheme,
  detectFailureTheme,
  detectFearTheme,
  detectAnchorTheme,
} from "../../services/themeDetection";
import { generateCoachReply } from "../../services/onboardingApi";

const SCREEN_WIDTH = Dimensions.get("window").width;

// ─── Step & source types ──────────────────────────────────────────────────────

type ScreenStep =
  | "welcome"
  | "name"
  | "activity"
  | "coach-reply"
  | "time"
  | "motivation-intro"
  | "ask-trigger"
  | "ask-past-attempts"
  | "ask-what-stopped"
  | "challenges-intro"
  | "ask-fear"
  | "ask-obstacles"
  | "values-intro"
  | "ask-anchor"
  | "ask-vision"
  | "summary-intro"
  | "reflection-summary"
  | "first-session-preview"
  | "ask-start-day";

type ReplySource =
  | "name"
  | "activity"
  | "time"
  | "trigger"
  | "what-stopped"
  | "never"
  | "fear"
  | "obstacles"
  | "anchor"
  | "vision"
  | "confirmation"
  | "start-day";

// ─── Static content ───────────────────────────────────────────────────────────

interface SelectOption<T> {
  label: string;
  value: T;
}

const ACTIVITY_OPTIONS: SelectOption<ActivityLevel>[] = [
  { label: "Haven't exercised in years", value: "no_exercise_years" },
  { label: "Occasionally walk, nothing regular", value: "occasionally_walk" },
  { label: "Somewhat active but inconsistent", value: "somewhat_active" },
  { label: "Active but want to run specifically", value: "active_want_run" },
];

const TIME_OPTIONS: SelectOption<TimePreference>[] = [
  { label: "Morning — before the day starts", value: "morning" },
  { label: "Midday — lunch break or afternoon", value: "midday" },
  { label: "Evening — after work winds down", value: "evening" },
  { label: "It varies — depends on the day", value: "varies" },
];

const PAST_ATTEMPTS_OPTIONS: SelectOption<PastAttempts>[] = [
  { label: "Yes, multiple times", value: "multiple" },
  { label: "Once or twice", value: "once_twice" },
  { label: "Not really — fresh start", value: "never" },
];

const OBSTACLE_OPTIONS: SelectOption<ObstacleId>[] = [
  { label: "Busy work schedule", value: "busy_work" },
  { label: "Family responsibilities", value: "family_responsibilities" },
  { label: "Weather or seasons", value: "weather" },
  { label: "Motivation dips", value: "motivation_dips" },
  { label: "Physical limitations", value: "physical_limitations" },
  { label: "Inconsistent routine", value: "inconsistent_routine" },
  { label: "Tiredness / low energy", value: "tiredness" },
  { label: "Other", value: "other" },
];

const START_DAY_OPTIONS: SelectOption<"today" | "tomorrow">[] = [
  { label: "Today — let's go", value: "today" },
  { label: "Tomorrow — I'll be ready", value: "tomorrow" },
];

function formatObstacleLabels(ids: ObstacleId[], otherText: string): string {
  return ids
    .map((id) => {
      if (id === "other") return otherText || "Other";
      return OBSTACLE_OPTIONS.find((o) => o.value === id)?.label ?? id;
    })
    .join(", ");
}

const MIN_INPUT_LENGTH = 1;
const HOLD_THRESHOLD_MS = 200;

// ─── Thinking indicator ───────────────────────────────────────────────────────

function ThinkingDots() {
  const a0 = useRef(new Animated.Value(0.3)).current;
  const a1 = useRef(new Animated.Value(0.3)).current;
  const a2 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anims = [a0, a1, a2].map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(v, {
            toValue: 1,
            duration: 320,
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0.3,
            duration: 320,
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [a0, a1, a2]);

  return (
    <View style={thinkingStyles.dotsRow}>
      {[a0, a1, a2].map((v, i) => (
        <Animated.View key={i} style={[thinkingStyles.dot, { opacity: v }]} />
      ))}
    </View>
  );
}

const thinkingStyles = StyleSheet.create({
  dotsRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CoachSetupScreen() {
  const [currentStep, setCurrentStep] = useState<ScreenStep>("welcome");
  const [nameInput, setNameInput] = useState("");
  const [triggerInput, setTriggerInput] = useState("");
  const [stoppedInput, setStoppedInput] = useState("");
  const [fearInput, setFearInput] = useState("");
  const [selectedObstacles, setSelectedObstacles] = useState<ObstacleId[]>([]);
  const [obstaclesOtherInput, setObstaclesOtherInput] = useState("");
  const [anchorInput, setAnchorInput] = useState("");
  const [visionInput, setVisionInput] = useState("");
  const [coachReplyText, setCoachReplyText] = useState("");
  const [coachReplyQuote, setCoachReplyQuote] = useState("");
  const [isGeneratingReply, setIsGeneratingReply] = useState(false);

  // Keyboard height tracking (moves CTA above keyboard)
  const [kbHeight, setKbHeight] = useState(0);
  const inputScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const show1 = Keyboard.addListener("keyboardWillShow", (e) =>
      setKbHeight(e.endCoordinates.height),
    );
    const show2 = Keyboard.addListener("keyboardDidShow", (e) =>
      setKbHeight(e.endCoordinates.height),
    );
    const hide1 = Keyboard.addListener("keyboardWillHide", () =>
      setKbHeight(0),
    );
    const hide2 = Keyboard.addListener("keyboardDidHide", () => setKbHeight(0));
    return () => {
      show1.remove();
      show2.remove();
      hide1.remove();
      hide2.remove();
    };
  }, []);

  useEffect(() => {
    if (kbHeight > 0) {
      setTimeout(
        () => inputScrollRef.current?.scrollToEnd({ animated: true }),
        50,
      );
    }
  }, [kbHeight]);

  // Async-safe refs
  const nameRef = useRef("");
  const pastAttemptsRef = useRef<PastAttempts>("multiple");
  const onReplyAdvance = useRef<() => void>(() => {});
  const replySourceRef = useRef<ReplySource>("activity");
  const isAnimating = useRef(false);
  const transitionTarget = useRef<ScreenStep>("ask-trigger");

  // Progress bar refs
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressAnimation = useRef<Animated.CompositeAnimation | null>(null);
  const progressCurrentValue = useRef(0);
  const progressTotalDuration = useRef(5000);
  const progressOnComplete = useRef<() => void>(() => {});

  // Hold-to-pause refs
  const pressStartTime = useRef(0);

  // Step transition animation
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const {
    setupData,
    setUserName,
    setActivityLevel,
    setTimePreference,
    setTrigger,
    setPastAttempts,
    setPastFailure,
    setFear,
    setObstacles,
    setAnchor,
    setVision,
    setPreferredStartDate,
    markSetupStarted,
    markSetupComplete,
  } = useCoachSetupStore();

  useEffect(() => {
    const id = progressAnim.addListener(({ value }) => {
      progressCurrentValue.current = value;
    });
    return () => progressAnim.removeListener(id);
  }, [progressAnim]);

  useEffect(() => {
    markSetupStarted();
    return () => pauseProgressBar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const FADE_IN_MS = 260;

    if (currentStep === "coach-reply") {
      const timer = setTimeout(
        () => startProgressBar(5000, () => onReplyAdvance.current()),
        FADE_IN_MS,
      );
      return () => clearTimeout(timer);
    }
    if (currentStep === "motivation-intro") {
      transitionTarget.current = "ask-trigger";
      const timer = setTimeout(
        () => startProgressBar(3500, () => transitionTo("ask-trigger")),
        FADE_IN_MS,
      );
      return () => clearTimeout(timer);
    }
    if (currentStep === "challenges-intro") {
      transitionTarget.current = "ask-fear";
      const timer = setTimeout(
        () => startProgressBar(3000, () => transitionTo("ask-fear")),
        FADE_IN_MS,
      );
      return () => clearTimeout(timer);
    }
    if (currentStep === "values-intro") {
      transitionTarget.current = "ask-anchor";
      const timer = setTimeout(
        () => startProgressBar(2500, () => transitionTo("ask-anchor")),
        FADE_IN_MS,
      );
      return () => clearTimeout(timer);
    }
    if (currentStep === "summary-intro") {
      transitionTarget.current = "reflection-summary";
      const timer = setTimeout(
        () => startProgressBar(3500, () => transitionTo("reflection-summary")),
        FADE_IN_MS,
      );
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  // ── Step transition ───────────────────────────────────────────────────────────

  const transitionTo = useCallback(
    (next: ScreenStep | (() => void)) => {
      if (isAnimating.current) return;
      isAnimating.current = true;

      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -16,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (typeof next === "function") {
          next();
          isAnimating.current = false;
          return;
        }
        setCurrentStep(next);
        translateY.setValue(20);
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 260,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 0,
            duration: 260,
            useNativeDriver: true,
          }),
        ]).start(() => {
          isAnimating.current = false;
        });
      });
    },
    [opacity, translateY],
  );

  // ── Progress bar helpers ──────────────────────────────────────────────────────

  const pauseProgressBar = () => {
    progressAnimation.current?.stop();
  };

  const resumeProgressBar = () => {
    const remaining = 1 - progressCurrentValue.current;
    if (remaining <= 0) return;
    const anim = Animated.timing(progressAnim, {
      toValue: 1,
      duration: progressTotalDuration.current * remaining,
      useNativeDriver: false,
    });
    progressAnimation.current = anim;
    anim.start(({ finished }) => {
      if (finished) progressOnComplete.current();
    });
  };

  const startProgressBar = (duration: number, onComplete: () => void) => {
    progressOnComplete.current = onComplete;
    progressTotalDuration.current = duration;
    progressAnim.setValue(0);
    progressCurrentValue.current = 0;
    const anim = Animated.timing(progressAnim, {
      toValue: 1,
      duration,
      useNativeDriver: false,
    });
    progressAnimation.current = anim;
    anim.start(({ finished }) => {
      if (finished) progressOnComplete.current();
    });
  };

  const cancelAutoAdvance = () => {
    pauseProgressBar();
  };

  // ── Hold-to-pause handlers ────────────────────────────────────────────────────

  const handleProgressPressIn = () => {
    pressStartTime.current = Date.now();
    pauseProgressBar();
  };

  const handleReplyPressOut = () => {
    const held = Date.now() - pressStartTime.current;
    if (held < HOLD_THRESHOLD_MS) {
      onReplyAdvance.current();
    } else {
      resumeProgressBar();
    }
  };

  const handleTransitionPressOut = () => {
    const held = Date.now() - pressStartTime.current;
    if (held < HOLD_THRESHOLD_MS) {
      transitionTo(transitionTarget.current);
    } else {
      resumeProgressBar();
    }
  };

  // ── Back navigation ───────────────────────────────────────────────────────────

  const phase2LastStep = (): ScreenStep =>
    pastAttemptsRef.current === "never"
      ? "ask-past-attempts"
      : "ask-what-stopped";

  const goBack = () => {
    switch (currentStep) {
      case "name":
        transitionTo("welcome");
        break;
      case "activity":
        transitionTo("name");
        break;
      case "coach-reply":
        cancelAutoAdvance();
        switch (replySourceRef.current) {
          case "name":
            transitionTo("name");
            break;
          case "activity":
            transitionTo("activity");
            break;
          case "time":
            transitionTo("time");
            break;
          case "trigger":
            transitionTo("ask-trigger");
            break;
          case "what-stopped":
            transitionTo("ask-what-stopped");
            break;
          case "never":
            transitionTo("ask-past-attempts");
            break;
          case "fear":
            transitionTo("ask-fear");
            break;
          case "obstacles":
            transitionTo("ask-obstacles");
            break;
          case "anchor":
            transitionTo("ask-anchor");
            break;
          case "vision":
            transitionTo("ask-vision");
            break;
          case "confirmation":
            transitionTo("reflection-summary");
            break;
          case "start-day":
            transitionTo("ask-start-day");
            break;
        }
        break;
      case "time":
        transitionTo("activity");
        break;
      case "motivation-intro":
        cancelAutoAdvance();
        transitionTo("time");
        break;
      case "ask-trigger":
        transitionTo("time");
        break;
      case "ask-past-attempts":
        transitionTo("ask-trigger");
        break;
      case "ask-what-stopped":
        transitionTo("ask-past-attempts");
        break;
      case "challenges-intro":
        cancelAutoAdvance();
        transitionTo(phase2LastStep());
        break;
      case "ask-fear":
        transitionTo(phase2LastStep());
        break;
      case "ask-obstacles":
        transitionTo("ask-fear");
        break;
      case "values-intro":
        cancelAutoAdvance();
        transitionTo("ask-obstacles");
        break;
      case "ask-anchor":
        transitionTo("ask-obstacles");
        break;
      case "ask-vision":
        transitionTo("ask-anchor");
        break;
      case "summary-intro":
        cancelAutoAdvance();
        transitionTo("ask-vision");
        break;
      case "reflection-summary":
        transitionTo("ask-vision");
        break;
      case "first-session-preview":
        transitionTo("reflection-summary");
        break;
      case "ask-start-day":
        transitionTo("first-session-preview");
        break;
    }
  };

  // ── Step handlers ─────────────────────────────────────────────────────────────

  const fetchAndShowReply = async (
    step: string,
    source: ReplySource,
    userInput: string | string[],
    next: () => void,
    quote = "",
    previousAnswers?: Record<string, unknown>,
  ) => {
    setIsGeneratingReply(true);
    const reply = await generateCoachReply(
      { step, userName: nameRef.current, userInput, previousAnswers },
      nameRef.current,
    );

    // Prepare reply state while thinking dots are still visible (no flash)
    replySourceRef.current = source;
    setCoachReplyText(reply);
    setCoachReplyQuote(quote);
    onReplyAdvance.current = next;

    // Fade out thinking dots → swap content while invisible → fade in reply
    isAnimating.current = true;
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -16,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsGeneratingReply(false);
      setCurrentStep("coach-reply");
      translateY.setValue(20);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 260,
          useNativeDriver: true,
        }),
      ]).start(() => {
        isAnimating.current = false;
      });
    });
  };

  const handleNameContinue = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    Keyboard.dismiss();
    nameRef.current = trimmed;
    setUserName(trimmed);
    await fetchAndShowReply("name", "name", trimmed, () =>
      transitionTo("activity"),
    );
  };

  const handleActivitySelect = async (option: SelectOption<ActivityLevel>) => {
    setActivityLevel(option.value);
    await fetchAndShowReply("activity", "activity", option.value, () =>
      transitionTo("time"),
    );
  };

  const handleTimeSelect = async (option: SelectOption<TimePreference>) => {
    setTimePreference(option.value);
    await fetchAndShowReply(
      "time",
      "time",
      option.value,
      () => transitionTo("motivation-intro"),
      "",
      { activityLevel: setupData.activityLevel ?? undefined },
    );
  };

  const handleTriggerContinue = async () => {
    const text = triggerInput.trim();
    if (text.length < MIN_INPUT_LENGTH) return;
    Keyboard.dismiss();
    const theme = detectTriggerTheme(text);
    setTrigger(text, theme);
    await fetchAndShowReply(
      "trigger",
      "trigger",
      text,
      () => transitionTo("ask-past-attempts"),
      text,
      {
        activityLevel: setupData.activityLevel ?? undefined,
        timePreference: setupData.timePreference ?? undefined,
      },
    );
  };

  const handlePastAttemptsSelect = async (
    option: SelectOption<PastAttempts>,
  ) => {
    setPastAttempts(option.value);
    pastAttemptsRef.current = option.value;

    if (option.value === "never") {
      await fetchAndShowReply(
        "past-attempts-never",
        "never",
        option.label,
        () => transitionTo("challenges-intro"),
        "",
        {
          activityLevel: setupData.activityLevel ?? undefined,
          timePreference: setupData.timePreference ?? undefined,
          triggerStatement: setupData.triggerStatement || undefined,
        },
      );
    } else {
      transitionTo("ask-what-stopped");
    }
  };

  const handleStoppedContinue = async () => {
    const text = stoppedInput.trim();
    if (text.length < MIN_INPUT_LENGTH) return;
    Keyboard.dismiss();
    const theme = detectFailureTheme(text);
    setPastFailure(text, theme);
    await fetchAndShowReply(
      "what-stopped",
      "what-stopped",
      text,
      () => transitionTo("challenges-intro"),
      text,
      {
        activityLevel: setupData.activityLevel ?? undefined,
        timePreference: setupData.timePreference ?? undefined,
        triggerStatement: setupData.triggerStatement || undefined,
        pastAttempts: setupData.pastAttempts ?? undefined,
      },
    );
  };

  const handleFearContinue = async () => {
    const text = fearInput.trim();
    if (text.length < MIN_INPUT_LENGTH) return;
    Keyboard.dismiss();
    const theme = detectFearTheme(text);
    setFear(text, theme);
    await fetchAndShowReply(
      "fear",
      "fear",
      text,
      () => transitionTo("ask-obstacles"),
      text,
      {
        activityLevel: setupData.activityLevel ?? undefined,
        triggerStatement: setupData.triggerStatement || undefined,
        pastAttempts: setupData.pastAttempts ?? undefined,
        pastFailureReason: setupData.pastFailureReason || undefined,
      },
    );
  };

  const handleObstacleToggle = (id: ObstacleId) => {
    setSelectedObstacles((prev) =>
      prev.includes(id) ? prev.filter((o) => o !== id) : [...prev, id],
    );
  };

  const handleObstaclesContinue = async () => {
    const hasOther = selectedObstacles.includes("other");
    if (hasOther && obstaclesOtherInput.trim().length < MIN_INPUT_LENGTH)
      return;
    Keyboard.dismiss();
    const otherText = obstaclesOtherInput.trim();
    setObstacles(selectedObstacles, otherText);
    const obstacleLabels = selectedObstacles.map((id) => {
      if (id === "other") return otherText || "Other";
      return OBSTACLE_OPTIONS.find((o) => o.value === id)?.label ?? id;
    });
    const quote = formatObstacleLabels(selectedObstacles, otherText);
    await fetchAndShowReply(
      "obstacles",
      "obstacles",
      obstacleLabels,
      () => transitionTo("values-intro"),
      quote,
      {
        triggerStatement: setupData.triggerStatement || undefined,
        primaryFear: setupData.primaryFear || undefined,
      },
    );
  };

  const handleAnchorContinue = async () => {
    const text = anchorInput.trim();
    if (text.length < MIN_INPUT_LENGTH) return;
    Keyboard.dismiss();
    const theme = detectAnchorTheme(text);
    setAnchor(text, theme);
    await fetchAndShowReply(
      "anchor",
      "anchor",
      text,
      () => transitionTo("ask-vision"),
      text,
      {
        triggerStatement: setupData.triggerStatement || undefined,
        primaryFear: setupData.primaryFear || undefined,
        obstacles: setupData.obstacles.length ? setupData.obstacles : undefined,
      },
    );
  };

  const handleVisionContinue = async () => {
    const text = visionInput.trim();
    if (text.length < MIN_INPUT_LENGTH) return;
    Keyboard.dismiss();
    setVision(text);
    await fetchAndShowReply(
      "vision",
      "vision",
      text,
      () => transitionTo("summary-intro"),
      text,
      {
        anchorPerson: setupData.anchorPerson || undefined,
        triggerStatement: setupData.triggerStatement || undefined,
      },
    );
  };

  const handleConfirmSummary = async () => {
    await fetchAndShowReply(
      "confirmation",
      "confirmation",
      "This is accurate",
      () => transitionTo("first-session-preview"),
      "",
      {
        activityLevel: setupData.activityLevel ?? undefined,
        timePreference: setupData.timePreference ?? undefined,
        triggerStatement: setupData.triggerStatement || undefined,
        pastAttempts: setupData.pastAttempts ?? undefined,
        pastFailureReason: setupData.pastFailureReason || undefined,
        primaryFear: setupData.primaryFear || undefined,
        obstacles: setupData.obstacles.length ? setupData.obstacles : undefined,
        anchorPerson: setupData.anchorPerson || undefined,
        successVision: setupData.successVision || undefined,
      },
    );
  };

  const handleStartDaySelect = async (
    option: SelectOption<"today" | "tomorrow">,
  ) => {
    setPreferredStartDate(option.value);
    await fetchAndShowReply(
      "start-day",
      "start-day",
      option.value,
      () => transitionTo(() => markSetupComplete()),
      "",
      {
        anchorPerson: setupData.anchorPerson || undefined,
        successVision: setupData.successVision || undefined,
        triggerStatement: setupData.triggerStatement || undefined,
      },
    );
  };

  // ─── Renderers ────────────────────────────────────────────────────────────────

  const renderProgressBar = () => (
    <View style={styles.progressTrack}>
      <Animated.View
        style={[
          styles.progressFill,
          {
            width: progressAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, SCREEN_WIDTH - SIDE_PAD * 2],
            }),
          },
        ]}
      />
    </View>
  );

  const renderBackButton = () => (
    <Pressable
      style={({ pressed }) => [
        styles.backBtn,
        pressed && styles.backBtnPressed,
      ]}
      onPress={goBack}
      hitSlop={12}
    >
      <Ionicons name="chevron-back" size={28} color={colors.textSecondary} />
    </Pressable>
  );

  const renderThinking = () => (
    <View style={styles.thinkingContainer}>
      <ThinkingDots />
      <Text style={styles.thinkingLabel}>Your coach is thinking...</Text>
    </View>
  );

  const renderWelcome = () => (
    <View style={[styles.screen, styles.screenNoBack]}>
      <View style={styles.body}>
        <Text style={styles.welcomeHeading}>
          Hey! I'm your coach for this journey.
        </Text>
        <Text style={styles.welcomeBody}>
          Before we start, I want to understand YOU — not just your fitness
          level, but what's driving you, what's held you back, and what success
          actually looks like for you.
        </Text>
        <Text style={styles.welcomeNote}>
          This isn't a quiz. Just a conversation between us.
        </Text>
      </View>
      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            pressed && styles.primaryBtnPressed,
          ]}
          onPress={() => transitionTo("name")}
        >
          <Text style={styles.primaryBtnLabel}>Let's do it</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderNameInput = () => (
    <ScrollView
      ref={inputScrollRef}
      style={styles.flex}
      contentContainerStyle={[
        styles.screenScrollContent,
        kbHeight > 0 && { paddingBottom: kbHeight },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {renderBackButton()}
      <View style={styles.body}>
        <Text style={styles.stepHint}>About you</Text>
        <Text style={styles.question}>What should{"\n"}I call you?</Text>
        <TextInput
          style={styles.bigInput}
          value={nameInput}
          onChangeText={setNameInput}
          placeholder="Your name"
          placeholderTextColor={colors.textTertiary}
          returnKeyType="done"
          onSubmitEditing={handleNameContinue}
          autoFocus
          maxLength={40}
          autoCapitalize="words"
          autoCorrect={false}
          selectionColor={colors.primary}
        />
      </View>
      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            !nameInput.trim() && styles.primaryBtnDisabled,
            pressed && !!nameInput.trim() && styles.primaryBtnPressed,
          ]}
          onPress={handleNameContinue}
          disabled={!nameInput.trim()}
        >
          <Text style={styles.primaryBtnLabel}>Continue</Text>
        </Pressable>
      </View>
    </ScrollView>
  );

  const renderOptionCards = (
    hint: string,
    question: string,
    subtext: string | null,
    options: SelectOption<any>[],
    onSelect: (o: SelectOption<any>) => void,
  ) => (
    <View style={styles.screen}>
      {renderBackButton()}
      <View style={styles.body}>
        <Text style={styles.stepHint}>{hint}</Text>
        <Text style={styles.question}>{question}</Text>
        {subtext ? <Text style={styles.questionSubtext}>{subtext}</Text> : null}
      </View>
      <View style={styles.optionList}>
        {options.map((opt) => (
          <Pressable
            key={opt.value}
            style={({ pressed }) => [
              styles.optionCard,
              pressed && styles.optionCardActive,
            ]}
            onPress={() => onSelect(opt)}
          >
            <Text style={styles.optionLabel}>{opt.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const renderCoachReply = () => {
    const isFinale = replySourceRef.current === "start-day";
    return (
      <View style={styles.flex}>
        {!isFinale && renderProgressBar()}
        <View style={styles.screen}>
          {renderBackButton()}
          {isFinale ? (
            <>
              <View style={styles.replyTapArea}>
                {coachReplyQuote ? (
                  <View style={styles.quoteBlock}>
                    <Text style={styles.quoteText}>{coachReplyQuote}</Text>
                  </View>
                ) : null}
                <Text style={styles.replyText}>{coachReplyText}</Text>
              </View>
              <View style={styles.footer}>
                <Pressable
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    pressed && styles.primaryBtnPressed,
                  ]}
                  onPress={() => transitionTo(() => markSetupComplete())}
                >
                  <Text style={styles.primaryBtnLabel}>Let's Go</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <Pressable
              style={styles.replyTapArea}
              onPressIn={handleProgressPressIn}
              onPressOut={handleReplyPressOut}
            >
              {coachReplyQuote ? (
                <View style={styles.quoteBlock}>
                  <Text style={styles.quoteText}>{coachReplyQuote}</Text>
                </View>
              ) : null}
              <Text style={styles.replyText}>{coachReplyText}</Text>
              <Text style={styles.replyHint}>
                Hold to pause · tap to continue
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  const renderTransitionScreen = (
    hint: string,
    heading: string,
    body: string,
  ) => (
    <View style={styles.flex}>
      {renderProgressBar()}
      <View style={styles.screen}>
        {renderBackButton()}
        <Pressable
          style={styles.replyTapArea}
          onPressIn={handleProgressPressIn}
          onPressOut={handleTransitionPressOut}
        >
          <Text style={styles.stepHint}>{hint}</Text>
          <Text style={styles.transitionHeading}>{heading}</Text>
          <Text style={styles.transitionBody}>{body}</Text>
          <Text style={styles.replyHint}>Hold to pause · tap to continue</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderMultilineInput = (
    hint: string,
    question: string,
    subtext: string,
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
    onContinue: () => void,
  ) => (
    <ScrollView
      ref={inputScrollRef}
      style={styles.flex}
      contentContainerStyle={[
        styles.screenScrollContent,
        kbHeight > 0 && { paddingBottom: kbHeight },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {renderBackButton()}
      <View style={styles.body}>
        <Text style={styles.stepHint}>{hint}</Text>
        <Text style={styles.question}>{question}</Text>
        <Text style={styles.questionSubtext}>{subtext}</Text>
        <TextInput
          style={styles.multilineInput}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          multiline
          numberOfLines={4}
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
          autoCorrect={false}
          selectionColor={colors.primary}
          textAlignVertical="top"
        />
      </View>
      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            value.trim().length < MIN_INPUT_LENGTH && styles.primaryBtnDisabled,
            pressed && value.trim().length >= MIN_INPUT_LENGTH && styles.primaryBtnPressed,
          ]}
          onPress={onContinue}
          disabled={value.trim().length < MIN_INPUT_LENGTH}
        >
          <Text style={styles.primaryBtnLabel}>Continue</Text>
        </Pressable>
      </View>
    </ScrollView>
  );

  const renderObstaclesSelect = () => {
    const hasOther = selectedObstacles.includes("other");
    const canContinue =
      selectedObstacles.length > 0 &&
      (!hasOther || obstaclesOtherInput.trim().length >= MIN_INPUT_LENGTH);

    return (
      <View style={styles.screen}>
        {renderBackButton()}
        <View style={styles.obstacleHeader}>
          <Text style={styles.stepHint}>Real life</Text>
          <Text style={styles.question}>
            What obstacles do you{"\n"}know you'll face?
          </Text>
          <Text style={styles.questionSubtext}>Select all that apply.</Text>
        </View>
        <ScrollView
          ref={inputScrollRef}
          style={styles.flex}
          contentContainerStyle={[
            styles.obstacleList,
            kbHeight > 0 && { paddingBottom: kbHeight },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {OBSTACLE_OPTIONS.map((opt) => {
            const selected = selectedObstacles.includes(opt.value);
            return (
              <Pressable
                key={opt.value}
                style={[
                  styles.multiSelectCard,
                  selected && styles.optionCardActive,
                ]}
                onPress={() => handleObstacleToggle(opt.value)}
              >
                <Text style={styles.optionLabel}>{opt.label}</Text>
                <View
                  style={[
                    styles.checkCircle,
                    selected && styles.checkCircleActive,
                  ]}
                >
                  {selected && (
                    <Ionicons name="checkmark" size={13} color="#fff" />
                  )}
                </View>
              </Pressable>
            );
          })}
          {hasOther && (
            <TextInput
              style={[styles.multilineInput, styles.otherInput]}
              value={obstaclesOtherInput}
              onChangeText={setObstaclesOtherInput}
              placeholder="What else might get in the way?"
              placeholderTextColor={colors.textTertiary}
              multiline
              autoCorrect={false}
              selectionColor={colors.primary}
              textAlignVertical="top"
            />
          )}
        </ScrollView>
        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              !canContinue && styles.primaryBtnDisabled,
              pressed && canContinue && styles.primaryBtnPressed,
            ]}
            onPress={handleObstaclesContinue}
            disabled={!canContinue}
          >
            <Text style={styles.primaryBtnLabel}>Continue</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderStoppedInput = () => {
    const isMultiple = pastAttemptsRef.current === "multiple";
    return renderMultilineInput(
      "What happened",
      isMultiple
        ? "You've tried multiple times.\nWhat kept stopping you?"
        : "What happened\nlast time?",
      isMultiple
        ? "No judgment — I'm asking so we can avoid it this time."
        : "What made you stop?",
      stoppedInput,
      setStoppedInput,
      "Time? Injury? Lost motivation? Life got busy? Something else?",
      handleStoppedContinue,
    );
  };

  const renderReflectionSummary = () => {
    const d = setupData;

    const activityLbl =
      ACTIVITY_OPTIONS.find((o) => o.value === d.activityLevel)?.label ??
      d.activityLevel ??
      "—";
    const timeLbl =
      TIME_OPTIONS.find((o) => o.value === d.timePreference)?.label ??
      d.timePreference ??
      "—";
    const pastLbl =
      d.pastAttempts === "multiple"
        ? "Multiple times"
        : d.pastAttempts === "once_twice"
          ? "Once or twice"
          : "Fresh start — never tried before";

    const SummarySection = ({
      label,
      children,
    }: {
      label: string;
      children: React.ReactNode;
    }) => (
      <View style={styles.summarySection}>
        <Text style={styles.summarySectionLabel}>{label}</Text>
        {children}
      </View>
    );

    const SummaryRow = ({ label, value }: { label: string; value: string }) => (
      <View style={styles.summaryRow}>
        <Text style={styles.summaryRowLabel}>{label}</Text>
        <Text style={styles.summaryRowValue}>{value}</Text>
      </View>
    );

    return (
      <View style={styles.screen}>
        {renderBackButton()}
        <Text style={styles.summaryHeading}>
          Here's what I know about you, {d.userName}.
        </Text>
        <ScrollView
          style={styles.flex}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.summaryContent}
          keyboardShouldPersistTaps="handled"
        >
          <SummarySection label="YOUR STARTING POINT">
            <SummaryRow label="Activity level" value={activityLbl} />
            <SummaryRow label="Best time to train" value={timeLbl} />
          </SummarySection>

          <SummarySection label="WHY YOU'RE HERE">
            <SummaryRow
              label="What made you start"
              value={`"${d.triggerStatement}"`}
            />
          </SummarySection>

          <SummarySection label="YOUR HISTORY">
            <SummaryRow label="Tried before" value={pastLbl} />
            {d.pastFailureReason ? (
              <SummaryRow
                label="What stopped you"
                value={`"${d.pastFailureReason}"`}
              />
            ) : null}
          </SummarySection>

          <SummarySection label="FEARS & OBSTACLES">
            <SummaryRow label="Biggest fear" value={`"${d.primaryFear}"`} />
            <SummaryRow
              label="Obstacles to watch for"
              value={formatObstacleLabels(d.obstacles, d.obstaclesOther)}
            />
          </SummarySection>

          <SummarySection label="YOUR ANCHOR">
            <SummaryRow label="Doing it for" value={`"${d.anchorPerson}"`} />
          </SummarySection>

          <SummarySection label="YOUR VISION">
            <SummaryRow
              label="What success looks like"
              value={`"${d.successVision}"`}
            />
          </SummarySection>
        </ScrollView>

        <View style={styles.summaryFooter}>
          <Pressable
            style={({ pressed }) => [
              styles.ghostBtn,
              pressed && styles.ghostBtnPressed,
            ]}
            onPress={() => transitionTo("welcome")}
          >
            <Text style={styles.ghostBtnLabel}>Let me adjust</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              styles.summaryPrimaryBtn,
              pressed && styles.primaryBtnPressed,
            ]}
            onPress={handleConfirmSummary}
          >
            <Text style={styles.primaryBtnLabel}>This is accurate</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderFirstSessionPreview = () => (
    <View style={styles.screen}>
      {renderBackButton()}
      <View style={styles.body}>
        <Text style={styles.stepHint}>Day 1</Text>
        <Text style={styles.question}>
          Your first session{"\n"}is just 10 minutes.
        </Text>
        <Text style={styles.questionSubtext}>
          We start easy. A mix of walking and jogging — nothing that leaves you
          gasping. The goal on Day 1 is simple: show up and finish.
        </Text>
        <View style={styles.sessionDetails}>
          <View style={styles.sessionDetailRow}>
            <Ionicons name="time-outline" size={17} color={colors.textMuted} />
            <Text style={styles.sessionDetailText}>
              ~15 minutes including warm-up
            </Text>
          </View>
          <View style={styles.sessionDetailRow}>
            <Ionicons name="walk-outline" size={17} color={colors.textMuted} />
            <Text style={styles.sessionDetailText}>Walk/run intervals</Text>
          </View>
          <View style={styles.sessionDetailRow}>
            <Ionicons
              name="location-outline"
              size={17}
              color={colors.textMuted}
            />
            <Text style={styles.sessionDetailText}>Anywhere outside works</Text>
          </View>
        </View>
      </View>
      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            pressed && styles.primaryBtnPressed,
          ]}
          onPress={() => transitionTo("ask-start-day")}
        >
          <Text style={styles.primaryBtnLabel}>Continue</Text>
        </Pressable>
      </View>
    </View>
  );

  // ─── Root render ──────────────────────────────────────────────────────────────

  const renderCurrentStep = () => {
    if (isGeneratingReply) return renderThinking();

    switch (currentStep) {
      case "welcome":
        return renderWelcome();
      case "name":
        return renderNameInput();

      case "activity":
        return renderOptionCards(
          "Your starting point",
          "How would you describe your activity level right now?",
          null,
          ACTIVITY_OPTIONS,
          handleActivitySelect,
        );
      case "coach-reply":
        return renderCoachReply();
      case "time":
        return renderOptionCards(
          "Your schedule",
          "When's the best time for you to get outside?",
          "Don't overthink it — just your gut answer.",
          TIME_OPTIONS,
          handleTimeSelect,
        );

      case "motivation-intro":
        return renderTransitionScreen(
          "Getting personal",
          "Now I want to understand something deeper.\nThe real reason you're here.",
          "This is what makes me different from every other app you've tried.",
        );
      case "ask-trigger":
        return renderMultilineInput(
          "Your reason",
          "What made you\nstart today?",
          "Not someday — today.",
          triggerInput,
          setTriggerInput,
          "Something triggered this. What was it?",
          handleTriggerContinue,
        );
      case "ask-past-attempts":
        return renderOptionCards(
          "Your history",
          "Have you tried to get fit or start running before?",
          null,
          PAST_ATTEMPTS_OPTIONS,
          handlePastAttemptsSelect,
        );
      case "ask-what-stopped":
        return renderStoppedInput();

      case "challenges-intro":
        return renderTransitionScreen(
          "Looking ahead",
          "Now let's talk about what might\nget in the way this time.",
          "Not to scare you — so we can plan for it.",
        );
      case "ask-fear":
        return renderMultilineInput(
          "Your concern",
          "What's your biggest fear\nabout starting this?",
          'The thing in the back of your mind that says "what if..."',
          fearInput,
          setFearInput,
          "What if I fail? What if I can't do it? What if people see me?",
          handleFearContinue,
        );
      case "ask-obstacles":
        return renderObstaclesSelect();

      case "values-intro":
        return renderTransitionScreen(
          "Going deeper",
          "One more thing\nbefore we start.",
          "This might hit different.",
        );
      case "ask-anchor":
        return renderMultilineInput(
          "Your anchor",
          "Beyond yourself —\nis there anyone you're doing this for?",
          "Kids to keep up with? Partner you want more energy for? Or maybe it's just for you. That's valid too.",
          anchorInput,
          setAnchorInput,
          "My kids / my partner / my future self / just me...",
          handleAnchorContinue,
        );
      case "ask-vision":
        return renderMultilineInput(
          "Your vision",
          "If you actually do this —\nwhat changes in your life?",
          "Not weight or fitness numbers. How you feel. What you can do. Who you become.",
          visionInput,
          setVisionInput,
          "I'd feel... / I'd be able to... / I'd finally...",
          handleVisionContinue,
        );

      case "summary-intro":
        return renderTransitionScreen(
          "Almost there",
          "Let's make sure\nI've got this right.",
          "Before we start, I want to confirm I understand your story.",
        );
      case "reflection-summary":
        return renderReflectionSummary();
      case "first-session-preview":
        return renderFirstSessionPreview();
      case "ask-start-day":
        return renderOptionCards(
          "Day 1",
          "When do you want\nto start?",
          null,
          START_DAY_OPTIONS,
          handleStartDaySelect,
        );
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <Animated.View
        style={[styles.flex, { opacity, transform: [{ translateY }] }]}
      >
        {renderCurrentStep()}
      </Animated.View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const SIDE_PAD = spacing.screenPadding;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },

  // ── Progress bar ──
  progressTrack: {
    height: 2,
    marginHorizontal: SIDE_PAD,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  progressFill: {
    height: 2,
    backgroundColor: "rgba(255,255,255,0.85)",
  },

  // ── Thinking state ──
  thinkingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  thinkingLabel: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textMuted,
    letterSpacing: 0.2,
  },

  // ── Shared screen layout ──
  screen: {
    flex: 1,
    paddingHorizontal: SIDE_PAD,
    paddingTop: 20,
    paddingBottom: 8,
  },
  screenNoBack: { paddingTop: 48 },
  body: { flex: 1 },
  screenScrollContent: {
    flexGrow: 1,
    paddingHorizontal: SIDE_PAD,
    paddingTop: 20,
    paddingBottom: 8,
  },
  footer: { paddingTop: 16, paddingBottom: 4 },

  // ── Welcome ──
  welcomeHeading: {
    fontFamily: fonts.titleRegular,
    fontSize: 44,
    color: colors.textPrimary,
    lineHeight: 52,
    letterSpacing: 0.5,
    marginBottom: 28,
  },
  welcomeBody: {
    fontFamily: fonts.regular,
    fontSize: 17,
    color: colors.textSecondary,
    lineHeight: 27,
    letterSpacing: 0.2,
    marginBottom: 24,
  },
  welcomeNote: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.textPrimary,
    letterSpacing: 0.2,
    lineHeight: 24,
  },

  // ── Question header ──
  stepHint: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.primary,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 16,
  },
  question: {
    fontFamily: fonts.titleRegular,
    fontSize: 40,
    color: colors.textPrimary,
    lineHeight: 48,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  questionSubtext: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textSecondary,
    letterSpacing: 0.2,
    marginTop: 4,
    lineHeight: 22,
  },

  // ── Name input ──
  bigInput: {
    marginTop: 36,
    fontFamily: fonts.bold,
    fontSize: 30,
    color: colors.textPrimary,
    letterSpacing: 0.2,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    paddingBottom: 10,
    paddingTop: 0,
  },

  // ── Multi-line input ──
  multilineInput: {
    marginTop: 24,
    fontFamily: fonts.regular,
    fontSize: 17,
    color: colors.textPrimary,
    letterSpacing: 0.2,
    lineHeight: 26,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: 16,
    minHeight: 120,
    textAlignVertical: "top",
  },

  // ── Option cards ──
  optionList: { gap: 12, paddingBottom: 24 },
  optionCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    minHeight: 62,
    justifyContent: "center",
  },
  optionCardActive: {
    backgroundColor: colors.primaryDim,
    borderColor: colors.primary,
  },
  optionLabel: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.textPrimary,
    letterSpacing: 0.2,
    lineHeight: 22,
  },

  // ── Multi-select cards ──
  obstacleHeader: { marginBottom: 20 },
  obstacleList: { gap: 10, paddingBottom: 8 },
  multiSelectCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.textTertiary,
    marginLeft: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  checkCircleActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  otherInput: { marginTop: 8, marginBottom: 4 },

  // ── Coach reply & transitions ──
  replyTapArea: {
    flex: 1,
    justifyContent: "center",
    paddingBottom: 40,
  },
  quoteBlock: {
    borderLeftWidth: 2,
    borderLeftColor: colors.primary,
    paddingLeft: 14,
    marginBottom: 28,
  },
  quoteText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    letterSpacing: 0.2,
    lineHeight: 22,
  },
  replyText: {
    fontFamily: fonts.regular,
    fontSize: 22,
    color: colors.textPrimary,
    lineHeight: 34,
    letterSpacing: 0.2,
    marginBottom: 40,
  },
  replyHint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
    letterSpacing: 0.3,
  },
  transitionHeading: {
    fontFamily: fonts.titleRegular,
    fontSize: 38,
    color: colors.textPrimary,
    lineHeight: 46,
    letterSpacing: 0.5,
    marginBottom: 20,
  },
  transitionBody: {
    fontFamily: fonts.regular,
    fontSize: 17,
    color: colors.textSecondary,
    lineHeight: 26,
    letterSpacing: 0.2,
    marginBottom: 40,
  },

  // ── Back button ──
  backBtn: { alignSelf: "flex-start", marginLeft: -6, marginBottom: 16 },
  backBtnPressed: { opacity: 0.5 },

  // ── Primary CTA ──
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: touchTarget.button,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnDisabled: { backgroundColor: colors.dotInactive },
  primaryBtnPressed: { opacity: 0.84 },
  primaryBtnLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: "#fff",
    letterSpacing: 0.3,
  },

  // ── Reflection summary ──
  summaryHeading: {
    fontFamily: fonts.titleRegular,
    fontSize: 32,
    color: colors.textPrimary,
    lineHeight: 40,
    letterSpacing: 0.5,
    marginBottom: 20,
  },
  summaryContent: {
    gap: 16,
    paddingBottom: 12,
  },
  summarySection: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 10,
  },
  summarySectionLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.primary,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  summaryRow: { gap: 2 },
  summaryRowLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 0.2,
  },
  summaryRowValue: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 22,
    letterSpacing: 0.2,
  },
  summaryFooter: {
    paddingTop: 16,
    paddingBottom: 4,
    gap: 10,
  },
  summaryPrimaryBtn: { flex: 0 },
  ghostBtn: {
    borderRadius: 14,
    height: touchTarget.button,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
  },
  ghostBtnPressed: { opacity: 0.6 },
  ghostBtnLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },

  // ── First session preview ──
  sessionDetails: {
    marginTop: 32,
    gap: 14,
  },
  sessionDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sessionDetailText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textSecondary,
    letterSpacing: 0.2,
  },
});
