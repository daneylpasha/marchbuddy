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
  // Backgrounds
  background: "black",
  surface: "black",
  surfaceElevated: "#2A2A2A",
  surfaceBorder: "rgba(255,255,255,0.06)",

  // Primary accent — dark green
  primary: "#068a15",
  primaryBright: "#0BA820",
  primaryDim: "rgba(6,138,21,0.15)",
  primaryGlow: "rgba(6,138,21,0.5)",

  // Secondary accents
  success: "#00E676",
  successDim: "rgba(0,230,118,0.15)",

  // Gradient colors for buttons
  gradientStart: "#068a15",
  gradientEnd: "#0BA820",
  warning: "#FF9800",
  warningDim: "rgba(255,152,0,0.15)",
  danger: "#FF3D71",
  dangerDim: "rgba(255,61,113,0.15)",

  // Macro colors
  protein: "#068a15",
  carbs: "#FF9800",
  fat: "#FF2D78",

  // Muscle group colors
  muscleLegs: "#00E676",
  muscleChest: "#068a15",
  muscleBack: "#FF6D00",
  muscleShoulders: "#AB47BC",
  muscleCore: "#FFD600",
  muscleArms: "#FF3D71",

  // Text — improved contrast for dark backgrounds
  textPrimary: "#FFFFFF",
  textSecondary: "#A0A0A0",
  textTertiary: "#707070",
  textMuted: "#5A5A5A",

  // Specific
  water: "#1DE9B6",
  waterDim: "rgba(29,233,182,0.15)",
  streak: "#FF9800",
  divider: "#2A2A2A",
  dotInactive: "#333",

  // Gradients (used as overlay backgrounds)
  streakGradientStart: "rgba(6,138,21,0.08)",
  streakGradientEnd: "rgba(255,45,120,0.06)",
  cardGlow: "rgba(6,138,21,0.08)",
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
  // Screen titles — Bebas Neue (all-caps display)
  screenTitle: {
    fontFamily: fonts.titleRegular,
    fontSize: 34,
    color: colors.textPrimary,
    letterSpacing: 0.68,
    textTransform: "uppercase" as const,
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
