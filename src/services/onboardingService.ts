import type { UserProfile } from '../types';

// ─── Stage definitions ───────────────────────────────────────────────────────

export type InputType = 'text' | 'number' | 'select';

export interface OnboardingStage {
  id: string;
  messages: string[];
  inputType: InputType;
  options?: string[];        // for 'select' type
  numberUnit?: string;       // for 'number' type (display label)
  numberMin?: number;
  numberMax?: number;
  field: keyof PartialProfile | null; // which profile field this updates
  validate: (input: string) => string | null; // returns error message or null
  parse: (input: string) => any; // converts raw input to profile value
}

type PartialProfile = Omit<UserProfile, 'userId' | 'createdAt' | 'updatedAt' | 'onboardingCompleted'>;

const noValidation = () => null;
const textNotEmpty = (input: string) => input.trim() ? null : 'Please enter a response.';
const parseNumber = (min: number, max: number) => (input: string): string | null => {
  const n = Number(input);
  if (isNaN(n)) return 'Please enter a valid number.';
  if (n < min || n > max) return `Please enter a value between ${min} and ${max}.`;
  return null;
};

// ─── Trimmed stages (8 essential questions) ─────────────────────────────────

export const ONBOARDING_STAGES: OnboardingStage[] = [
  // Stage 0: Name (Step 1 — "Let's meet")
  {
    id: 'name',
    messages: ["Hey! I'm your AI fitness coach. Let's start simple — what should I call you?"],
    inputType: 'text',
    field: 'name',
    validate: textNotEmpty,
    parse: (input: string) => input.trim(),
  },
  // Stage 1: Age (Step 2 — "Your stats")
  {
    id: 'age',
    messages: ['How old are you?'],
    inputType: 'number',
    numberUnit: 'years',
    numberMin: 13,
    numberMax: 100,
    field: 'age',
    validate: parseNumber(13, 100),
    parse: (input: string) => Number(input),
  },
  // Stage 2: Gender
  {
    id: 'gender',
    messages: ['And your gender?'],
    inputType: 'select',
    options: ['Male', 'Female', 'Other'],
    field: 'gender',
    validate: noValidation,
    parse: (input: string) => input.toLowerCase(),
  },
  // Stage 3: Height
  {
    id: 'height',
    messages: ["What's your height in centimeters?"],
    inputType: 'number',
    numberUnit: 'cm',
    numberMin: 100,
    numberMax: 250,
    field: 'height',
    validate: parseNumber(100, 250),
    parse: (input: string) => Number(input),
  },
  // Stage 4: Current weight
  {
    id: 'currentWeight',
    messages: ["Your current weight in kg? Don't stress — it's just a starting point."],
    inputType: 'number',
    numberUnit: 'kg',
    numberMin: 30,
    numberMax: 300,
    field: 'currentWeight',
    validate: parseNumber(30, 300),
    parse: (input: string) => Number(input),
  },
  // Stage 5: Target weight
  {
    id: 'targetWeight',
    messages: ["What's your target weight? Even a rough idea is fine."],
    inputType: 'number',
    numberUnit: 'kg',
    numberMin: 30,
    numberMax: 300,
    field: 'targetWeight',
    validate: parseNumber(30, 300),
    parse: (input: string) => Number(input),
  },
  // Stage 6: Primary goal (Step 3 — "Your goal")
  {
    id: 'primaryGoal',
    messages: ["What's your main focus right now?"],
    inputType: 'select',
    options: ['Weight Loss', 'Muscle Building', 'General Fitness', 'Stamina & Endurance'],
    field: null, // handled in profile update logic
    validate: noValidation,
    parse: (input: string) => input,
  },
  // Stage 7: Current activity level
  {
    id: 'currentActivityLevel',
    messages: ["Last one — how active are you right now?"],
    inputType: 'select',
    options: ['Sedentary', 'Lightly Active', 'Moderately Active', 'Very Active'],
    field: 'currentActivityLevel',
    validate: noValidation,
    parse: (input: string) => input.toLowerCase(),
  },
];

// ─── Collected data from all stages ──────────────────────────────────────────

export interface OnboardingData {
  name: string;
  age: number;
  gender: string;
  height: number;
  currentWeight: number;
  targetWeight: number;
  primaryGoal: string;
  currentActivityLevel: string;
}

export function getEmptyOnboardingData(): OnboardingData {
  return {
    name: '',
    age: 0,
    gender: '',
    height: 0,
    currentWeight: 0,
    targetWeight: 0,
    primaryGoal: '',
    currentActivityLevel: '',
  };
}

// ─── Smart acknowledgments ───────────────────────────────────────────────────

export function generateSmartAcknowledgment(stageId: string, userResponse: string, data: OnboardingData): string | null {
  const response = userResponse.toLowerCase();

  switch (stageId) {
    case 'name':
      return `Great to meet you, ${userResponse.trim()}! Let's get to know you a bit better.`;

    case 'age':
      return Number(userResponse) >= 40
        ? `${data.name}, age is just context — plenty of people peak in their 40s and beyond.`
        : null; // skip ack to move faster

    case 'gender':
      return null;

    case 'height':
      return null;

    case 'currentWeight':
      return null;

    case 'targetWeight': {
      const gap = Math.abs(data.currentWeight - Number(userResponse));
      if (gap > 20) return `That's an ambitious goal — I like it. We'll build a realistic plan for that ${gap}kg shift.`;
      return null;
    }

    case 'primaryGoal':
      if (response.includes('weight loss')) return 'Weight loss it is. Smart nutrition + right training.';
      if (response.includes('muscle')) return 'Muscle building — let\'s get you growing.';
      if (response.includes('stamina')) return 'Endurance focus — we\'ll build that cardio base.';
      return null;

    case 'currentActivityLevel':
      if (response.includes('sedentary')) return 'Honest answer — I respect that. We\'ll start gentle.';
      return null;

    default:
      return null;
  }
}

// ─── Summary field definitions (for the editable summary card) ──────────────

export interface SummaryField {
  key: keyof OnboardingData;
  label: string;
  inputType: InputType;
  options?: string[];
  numberUnit?: string;
  numberMin?: number;
  numberMax?: number;
}

export const SUMMARY_FIELDS: SummaryField[] = [
  { key: 'name', label: 'Name', inputType: 'text' },
  { key: 'age', label: 'Age', inputType: 'number', numberUnit: 'years', numberMin: 13, numberMax: 100 },
  { key: 'gender', label: 'Gender', inputType: 'select', options: ['Male', 'Female', 'Other'] },
  { key: 'height', label: 'Height', inputType: 'number', numberUnit: 'cm', numberMin: 100, numberMax: 250 },
  { key: 'currentWeight', label: 'Current Weight', inputType: 'number', numberUnit: 'kg', numberMin: 30, numberMax: 300 },
  { key: 'targetWeight', label: 'Target Weight', inputType: 'number', numberUnit: 'kg', numberMin: 30, numberMax: 300 },
  { key: 'primaryGoal', label: 'Main Goal', inputType: 'select', options: ['Weight Loss', 'Muscle Building', 'General Fitness', 'Stamina & Endurance'] },
  { key: 'currentActivityLevel', label: 'Activity Level', inputType: 'select', options: ['Sedentary', 'Lightly Active', 'Moderately Active', 'Very Active'] },
];

// ─── Display value formatter ────────────────────────────────────────────────

export function formatDisplayValue(key: keyof OnboardingData, value: any): string {
  if (value === '' || value === 0) return '—';
  switch (key) {
    case 'age': return `${value} years`;
    case 'height': return `${value} cm`;
    case 'currentWeight':
    case 'targetWeight': return `${value} kg`;
    case 'gender': return String(value).charAt(0).toUpperCase() + String(value).slice(1);
    default: return String(value);
  }
}

// ─── Map collected data to UserProfile ───────────────────────────────────────

export function buildProfileFromData(userId: string, data: OnboardingData): UserProfile {
  const now = new Date().toISOString();

  return {
    userId,
    name: data.name,
    age: data.age,
    gender: data.gender,
    height: data.height,
    currentWeight: data.currentWeight,
    targetWeight: data.targetWeight,
    fitnessHistory: '',
    pastSports: [],
    peakFitnessLevel: '',
    currentActivityLevel: data.currentActivityLevel,
    injuries: [],
    dietaryPreferences: {
      type: 'non-veg',
      allergies: [],
      dislikes: [],
      cuisineRegion: '',
    },
    goals: {
      primaryGoal: data.primaryGoal,
      targetTimeline: '',
      targetWeight: data.targetWeight,
    },
    eatingContext: undefined,
    workoutSchedule: undefined,
    equipmentAvailable: [],
    onboardingCompleted: true,
    createdAt: now,
    updatedAt: now,
  };
}

// ─── Step mapping ───────────────────────────────────────────────────────────

export const TOTAL_STAGES = ONBOARDING_STAGES.length; // 8

// 4 user-facing steps: 1 (name), 2 (stats), 3 (goal), 4 (summary)
export const TOTAL_USER_STEPS = 4;

// Map stage index to the user-facing step number (1-4)
export function getStepNumber(stageIndex: number): number {
  if (stageIndex <= 0) return 1;  // name
  if (stageIndex <= 5) return 2;  // age, gender, height, weight, target
  if (stageIndex <= 7) return 3;  // goal, activity level
  return 4; // summary (shouldn't be reached via stages)
}

// ─── Correction stage mapping ────────────────────────────────────────────────

export const CORRECTION_STAGE_MAP: Record<string, number> = {};
ONBOARDING_STAGES.forEach((stage, index) => {
  CORRECTION_STAGE_MAP[stage.id] = index;
});
