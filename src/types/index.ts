// types/ — TypeScript type definitions
// Shared interfaces and types for user, workout, nutrition, progress, and API responses.

// ─── User & Profile ─────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  createdAt: string;
}

export interface DietaryPreferences {
  type: 'veg' | 'non-veg' | 'vegan';
  allergies: string[];
  dislikes: string[];
  cuisineRegion: string;
}

export interface UserGoals {
  primaryGoal: string;
  targetTimeline: string;
  targetWeight: number;
}

export interface UserProfile {
  userId: string;
  name: string;
  age: number;
  gender: string;
  height: number; // cm
  currentWeight: number; // kg
  targetWeight: number; // kg
  fitnessHistory: string;
  pastSports: string[];
  peakFitnessLevel: string;
  currentActivityLevel: string;
  injuries: string[];
  dietaryPreferences: DietaryPreferences;
  goals: UserGoals;
  eatingContext?: { cooksForSelf: string; eatsOutFrequency: string };
  workoutSchedule?: { daysPerWeek: string; timePreference: string };
  equipmentAvailable?: string[];
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Workout ─────────────────────────────────────────────────────────────────

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  sets: number;
  reps: number;
  restSeconds: number;
  order: number;
  weight?: number;           // AI-prescribed weight in kg (null for bodyweight)
  actualSets?: number;       // What user actually performed
  actualReps?: number;       // What user actually performed (total or last set)
  actualRepsPerSet?: number[]; // Per-set reps (e.g., [10, 9, 8] for 3 sets)
  actualWeight?: number;     // What user actually lifted in kg
  formCues?: string[];            // AI-generated form tips (e.g. "Keep back straight")
  feedback: 'completed' | 'skipped' | 'too-hard' | 'too-easy' | null;
  notes: string;
}

export interface WarmUpCoolDownExercise {
  id: string;
  name: string;
  duration?: string;    // e.g., "30 seconds", "10 reps"
  description?: string; // brief instruction/form cue
  order: number;
}

export interface ReadinessCheck {
  energyLevel: 1 | 2 | 3 | 4 | 5;
  sleepQuality?: 1 | 2 | 3 | 4 | 5;
  stressLevel?: 1 | 2 | 3 | 4 | 5;
  muscleSoreness?: 1 | 2 | 3 | 4 | 5;
  timeAvailable?: 15 | 30 | 45 | 60;
}

export interface WorkoutPlan {
  id: string;
  userId: string;
  date: string;
  exercises: Exercise[];
  warmUp?: WarmUpCoolDownExercise[];
  coolDown?: WarmUpCoolDownExercise[];
  status: 'pending' | 'in-progress' | 'completed' | 'skipped';
  isRestDay: boolean;
  restDayType: 'active-recovery' | 'complete-rest' | null;
  energyLevel?: 1 | 2 | 3 | 4 | 5;
  readiness?: ReadinessCheck;
  sessionRPE?: number;          // Post-workout RPE (1-10)
  workoutStartedAt?: string;    // ISO timestamp when workout started
  aiNotes: string;
  createdAt: string;
}

// ─── Nutrition ───────────────────────────────────────────────────────────────

export interface Meal {
  id: string;
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  name: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  feedback: 'ate-it' | 'swapped' | 'skipped' | null;
  swapDescription?: string;
  swapCalories?: number;
  swapProtein?: number;
  swapCarbs?: number;
  swapFat?: number;
  isOffPlan: boolean;
}

export interface MealPlan {
  id: string;
  userId: string;
  date: string;
  meals: Meal[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  createdAt: string;
}

export interface FoodSnapAIEstimate {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: 'low' | 'medium' | 'high';
  description: string;
}

export interface FoodSnapAmendedValues {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

export interface FoodSnap {
  id: string;
  userId: string;
  mealId?: string;
  imageUri: string;
  aiEstimate: FoodSnapAIEstimate;
  userAmended: boolean;
  amendedValues?: FoodSnapAmendedValues;
  createdAt: string;
}

// ─── Water ───────────────────────────────────────────────────────────────────

export interface WaterEntry {
  id: string;
  amount: number; // ml
  loggedAt: string;
}

export interface WaterLog {
  id: string;
  userId: string;
  date: string;
  goal: number; // ml
  consumed: number; // ml
  entries: WaterEntry[];
}

// ─── Chat ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  imageUri?: string;
  actionsTaken: string[];
  createdAt: string;
}

// ─── Progress ────────────────────────────────────────────────────────────────

export interface WeightEntry {
  id: string;
  userId: string;
  weight: number; // kg
  date: string;
}

export interface BodyMeasurement {
  id: string;
  userId: string;
  date: string;
  waist: number;
  chest: number;
  arms: number;
  notes: string;
}

export interface ProgressPhoto {
  id: string;
  userId: string;
  imageUri: string;
  type: 'front' | 'side';
  date: string;
}

export interface WeeklySummary {
  id: string;
  userId: string;
  weekStartDate: string;
  summaryText: string;
  insights: string[];
  createdAt: string;
}
