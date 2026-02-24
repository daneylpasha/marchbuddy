export const APP_CONFIG = {
  APP_NAME: "MarchBuddy",
  VERSION: "0.1.0",
  AI_MODEL: "claude-sonnet-4-20250514",
  DEFAULT_WATER_GOAL_ML: 2500,
  MAX_CHAT_HISTORY_FOR_CONTEXT: 20,
  MAX_WORKOUT_HISTORY_DAYS: 7,
  FOOD_SNAP_CONFIDENCE_THRESHOLD: 0.6,
  WEEKLY_SUMMARY_INTERVAL_DAYS: 7,
  TYPING_INDICATOR_DELAY_MS: { min: 500, max: 1500 },
  BEGINNER_RAMP_WEEKS: 4,
};

export const EQUIPMENT_OPTIONS = [
  "Bodyweight",
  "Dumbbells",
  "Barbell",
  "Cables",
  "Machines",
  "Pull-Up Bar",
  "Resistance Bands",
  "Kettlebell",
] as const;
