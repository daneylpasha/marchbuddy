// ─── FitTransformAI Design System ─────────────────────────────────────────
// Centralized theme constants for premium fitness app aesthetic
// Fonts: Bebas Neue (titles/display) + Montserrat (body/UI)

// ─── Font Families ────────────────────────────────────────────────────────

export const fonts = {
  // Display / Titles — Bebas Neue (all-caps, high-impact)
  titleRegular: "BebasNeue_400Regular",

  // Body / UI — Montserrat
  regular: "Montserrat_400Regular",
  medium: "Montserrat_500Medium",
  semiBold: "Montserrat_600SemiBold",
  bold: "Montserrat_700Bold",
} as const;

// ─── Colors ───────────────────────────────────────────────────────────────

export const colors = {
  // Backgrounds — slightly off-black for warmth on all screen types
  background: "#0A0A0A",
  surface: "#0A0A0A",
  surfaceElevated: "#1A1A1A",
  surfaceBorder: "rgba(255,255,255,0.08)",

  // Primary accent — warmer, more energetic green
  primary: "#10B981",
  primaryBright: "#34D399",
  primaryDim: "rgba(16,185,129,0.15)",
  primaryGlow: "rgba(16,185,129,0.45)",

  // Secondary accents
  success: "#34D399",
  successDim: "rgba(52,211,153,0.15)",

  // Gradient colors for buttons
  gradientStart: "#10B981",
  gradientEnd: "#34D399",
  warning: "#FBBF24",
  warningDim: "rgba(251,191,36,0.15)",
  danger: "#F43F5E",
  dangerDim: "rgba(244,63,94,0.15)",

  // Macro colors
  protein: "#10B981",
  carbs: "#FBBF24",
  fat: "#F43F5E",

  // Muscle group colors
  muscleLegs: "#34D399",
  muscleChest: "#10B981",
  muscleBack: "#FB923C",
  muscleShoulders: "#A78BFA",
  muscleCore: "#FBBF24",
  muscleArms: "#F43F5E",

  // Text — improved contrast for dark backgrounds
  textPrimary: "#FFFFFF",
  textSecondary: "#A1A1AA",
  textTertiary: "#71717A",
  textMuted: "#52525B",

  // Specific
  water: "#2DD4BF",
  waterDim: "rgba(45,212,191,0.15)",
  streak: "#FB923C",
  divider: "#1A1A1A",
  dotInactive: "#3F3F46",

  // Segment colors — used during active sessions
  segmentWarmup: "rgba(16,185,129,0.06)",
  segmentWalk: "rgba(56,189,248,0.10)",
  segmentRun: "rgba(16,185,129,0.14)",
  segmentCooldown: "rgba(167,139,250,0.08)",

  // Gradients (used as overlay backgrounds)
  streakGradientStart: "rgba(16,185,129,0.08)",
  streakGradientEnd: "rgba(244,63,94,0.06)",
  cardGlow: "rgba(16,185,129,0.08)",
} as const;

// ─── Typography ───────────────────────────────────────────────────────────

export const typography = {
  // Hero — large display (onboarding, celebrations)
  hero: {
    fontFamily: fonts.titleRegular,
    fontSize: 40,
    color: colors.textPrimary,
    letterSpacing: 0.8,
    textTransform: "uppercase" as const,
  },
  // Screen titles — Montserrat SemiBold (reserve Bebas for hero moments)
  screenTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 28,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  // Section headers inside cards
  sectionTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 18,
    fontWeight: "600" as const,
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  // Card titles
  cardTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    fontWeight: "600" as const,
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  // Hero stat numbers (calories, main metrics)
  statHero: {
    fontFamily: fonts.bold,
    fontSize: 48,
    fontWeight: "700" as const,
    color: colors.textPrimary,
    fontVariant: ["tabular-nums" as const],
    letterSpacing: 0.3,
  },
  // Large stat numbers
  statLarge: {
    fontFamily: fonts.bold,
    fontSize: 28,
    fontWeight: "700" as const,
    color: colors.textPrimary,
    fontVariant: ["tabular-nums" as const],
    letterSpacing: 0.3,
  },
  // Medium stat numbers
  statMedium: {
    fontFamily: fonts.semiBold,
    fontSize: 20,
    fontWeight: "600" as const,
    color: colors.textPrimary,
    fontVariant: ["tabular-nums" as const],
    letterSpacing: 0.3,
  },
  // Large body (emphasis)
  bodyLarge: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  // Body text
  body: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 22,
    letterSpacing: 0.3,
  },
  // Secondary body
  bodySecondary: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },
  // Button text — primary CTA
  button: {
    fontFamily: fonts.bold,
    fontSize: 15,
    fontWeight: "700" as const,
    letterSpacing: 0.8,
    textTransform: "uppercase" as const,
  },
  // Button text — secondary
  buttonSecondary: {
    fontFamily: fonts.medium,
    fontSize: 15,
    fontWeight: "500" as const,
    letterSpacing: 0.3,
  },
  // Small labels
  label: {
    fontFamily: fonts.medium,
    fontSize: 13,
    fontWeight: "500" as const,
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },
  // Overline / category labels
  overline: {
    fontFamily: fonts.bold,
    fontSize: 11,
    fontWeight: "700" as const,
    color: colors.textSecondary,
    letterSpacing: 1.2,
    textTransform: "uppercase" as const,
  },
  // Caption / hints
  caption: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textTertiary,
    lineHeight: 16,
    letterSpacing: 0.3,
  },
  // Caption bold
  captionBold: {
    fontFamily: fonts.medium,
    fontSize: 12,
    fontWeight: "500" as const,
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },
} as const;

// ─── Spacing ──────────────────────────────────────────────────────────────

export const spacing = {
  screenPadding: 24,
  cardPadding: 20,
  cardRadius: 18,
  cardMarginBottom: 16,
  sectionGap: 20,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

// ─── Touch Targets ────────────────────────────────────────────────────────

export const touchTarget = {
  min: 48,
  button: 52,
  iconButton: 44,
} as const;
