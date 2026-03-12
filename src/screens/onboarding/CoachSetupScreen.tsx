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
} from "../../store/coachSetupStore";
import { generateCoachReply } from "../../services/onboardingApi";

const SCREEN_WIDTH = Dimensions.get("window").width;

// ─── Step & source types ──────────────────────────────────────────────────────

type ScreenStep =
  | "welcome"
  | "name"
  | "activity"
  | "coach-reply"
  | "time"
  | "ready";

type ReplySource = "name" | "activity" | "time";

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
  const [coachReplyText, setCoachReplyText] = useState("");
  const [coachReplyQuote, setCoachReplyQuote] = useState("");
  const [isGeneratingReply, setIsGeneratingReply] = useState(false);

  // Keyboard height tracking
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
  const onReplyAdvance = useRef<() => void>(() => {});
  const replySourceRef = useRef<ReplySource>("activity");
  const isAnimating = useRef(false);

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
    if (held < 200) {
      onReplyAdvance.current();
    } else {
      resumeProgressBar();
    }
  };

  // ── Back navigation ───────────────────────────────────────────────────────────

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
        }
        break;
      case "time":
        transitionTo("activity");
        break;
      case "ready":
        transitionTo("time");
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

    // Prepare reply state while thinking dots are still visible
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
      () => transitionTo("ready"),
      "",
      { activityLevel: setupData.activityLevel ?? undefined },
    );
  };

  const handleReady = () => {
    transitionTo(() => {
      markSetupComplete();
    });
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
              outputRange: [0, SCREEN_WIDTH - spacing.screenPadding * 2],
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
        <Text style={styles.welcomeHeading}>Let's get you moving</Text>
        <Text style={styles.welcomeBody}>
          I'm your coach for this running journey. We'll start with just a few
          quick questions to understand your situation, then jump into Level 1.
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
          <Text style={styles.primaryBtnLabel}>Continue</Text>
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
        <Text style={styles.question}>What should I call you?</Text>
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
    options: SelectOption<any>[],
    onSelect: (o: SelectOption<any>) => void,
  ) => (
    <View style={styles.screen}>
      {renderBackButton()}
      <View style={styles.body}>
        <Text style={styles.stepHint}>{hint}</Text>
        <Text style={styles.question}>{question}</Text>
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

  const renderCoachReply = () => (
    <View style={styles.flex}>
      {renderProgressBar()}
      <View style={styles.screen}>
        {renderBackButton()}
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
          <Text style={styles.replyHint}>Hold to pause · tap to continue</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderReady = () => (
    <View style={[styles.screen, styles.screenNoBack]}>
      <View style={styles.body}>
        <Text style={styles.readyHeading}>You're all set, {setupData.userName}!</Text>
        <Text style={styles.readyBody}>Let's start with Level 1.</Text>
      </View>
      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            pressed && styles.primaryBtnPressed,
          ]}
          onPress={handleReady}
        >
          <Text style={styles.primaryBtnLabel}>Let's Go</Text>
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
          "How active are you right now?",
          ACTIVITY_OPTIONS,
          handleActivitySelect,
        );
      case "coach-reply":
        return renderCoachReply();
      case "time":
        return renderOptionCards(
          "Your schedule",
          "When do you prefer to move?",
          TIME_OPTIONS,
          handleTimeSelect,
        );
      case "ready":
        return renderReady();
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
  },

  // ── Name input ──
  bigInput: {
    marginTop: 24,
    fontFamily: fonts.semiBold,
    fontSize: 32,
    color: colors.textPrimary,
    letterSpacing: 0.2,
    lineHeight: 44,
  },

  // ── Step hint & question ──
  stepHint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    letterSpacing: 1.0,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  question: {
    fontFamily: fonts.semiBold,
    fontSize: 28,
    color: colors.textPrimary,
    lineHeight: 36,
    letterSpacing: -0.3,
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

  // ── Ready screen ──
  readyHeading: {
    fontFamily: fonts.semiBold,
    fontSize: 32,
    color: colors.textPrimary,
    lineHeight: 40,
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  readyBody: {
    fontFamily: fonts.regular,
    fontSize: 17,
    color: colors.textSecondary,
    lineHeight: 26,
    letterSpacing: 0.2,
  },
});
