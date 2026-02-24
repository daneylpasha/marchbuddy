import type { UserProfile } from '../types';
import { EQUIPMENT_OPTIONS } from '../config/appConfig';

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

export const ONBOARDING_STAGES: OnboardingStage[] = [
  // Stage 1: Welcome & Name
  {
    id: 'name',
    messages: ["Hey! I'm your AI fitness coach. I'm going to learn about you so I can build a plan that actually fits your life. Let's start simple — what should I call you?"],
    inputType: 'text',
    field: 'name',
    validate: textNotEmpty,
    parse: (input: string) => input.trim(),
  },
  // Stage 2: Basic Stats — Age
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
  // Stage 2: Height
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
  // Stage 2: Current weight
  {
    id: 'currentWeight',
    messages: ["And your current weight in kg? Don't stress about the number — it's just a starting point."],
    inputType: 'number',
    numberUnit: 'kg',
    numberMin: 30,
    numberMax: 300,
    field: 'currentWeight',
    validate: parseNumber(30, 300),
    parse: (input: string) => Number(input),
  },
  // Stage 3: Target weight
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
  // Stage 3: Primary goal
  {
    id: 'primaryGoal',
    messages: ["What's your main focus right now?"],
    inputType: 'select',
    options: ['Weight Loss', 'Muscle Building', 'General Fitness', 'Stamina & Endurance'],
    field: null, // handled in profile update logic
    validate: noValidation,
    parse: (input: string) => input,
  },
  // Stage 4: Fitness history
  {
    id: 'pastSports',
    messages: ['Were you active before? What sports or activities have you done?'],
    inputType: 'text',
    field: null,
    validate: textNotEmpty,
    parse: (input: string) => input.trim(),
  },
  // Stage 4: Time since active
  {
    id: 'fitnessHistory',
    messages: ['How long has it been since you were regularly active?'],
    inputType: 'select',
    options: ['Still active', 'Less than 6 months', '6-12 months', '1-3 years', '3+ years'],
    field: 'fitnessHistory',
    validate: noValidation,
    parse: (input: string) => input,
  },
  // Stage 5: Current activity level
  {
    id: 'currentActivityLevel',
    messages: ["How active are you right now? Be honest — no judgment here, just need the real picture."],
    inputType: 'select',
    options: ['Sedentary', 'Lightly Active', 'Moderately Active', 'Very Active'],
    field: 'currentActivityLevel',
    validate: noValidation,
    parse: (input: string) => input.toLowerCase(),
  },
  // Stage 5: Injuries
  {
    id: 'injuries',
    messages: ['Any injuries or physical limitations I should know about? If none, just say "none".'],
    inputType: 'text',
    field: null,
    validate: textNotEmpty,
    parse: (input: string) => input.trim(),
  },
  // Stage 6: Diet type
  {
    id: 'dietType',
    messages: ['Now let\'s talk food. Are you veg, non-veg, or vegan?'],
    inputType: 'select',
    options: ['Veg', 'Non-Veg', 'Vegan'],
    field: null,
    validate: noValidation,
    parse: (input: string) => input.toLowerCase().replace('-', '-') as 'veg' | 'non-veg' | 'vegan',
  },
  // Stage 6: Allergies
  {
    id: 'allergies',
    messages: ['Any food allergies or things you absolutely won\'t eat? If none, just say "none".'],
    inputType: 'text',
    field: null,
    validate: textNotEmpty,
    parse: (input: string) => input.trim(),
  },
  // Stage 6: Cuisine region
  {
    id: 'cuisineRegion',
    messages: ['What cuisine or region best describes how you eat day to day?'],
    inputType: 'select',
    options: ['South Asian', 'Mediterranean', 'East Asian', 'American', 'Middle Eastern', 'Mixed'],
    field: null,
    validate: noValidation,
    parse: (input: string) => input,
  },
  // Stage 7: Cooking context
  {
    id: 'cookingContext',
    messages: ['Do you cook for yourself or eat family meals?'],
    inputType: 'select',
    options: ['Cook for myself', 'Family meals', 'Mix of both'],
    field: null,
    validate: noValidation,
    parse: (input: string) => input,
  },
  // Stage 7: Eating out frequency
  {
    id: 'eatingOut',
    messages: ['How often do you eat out or order in?'],
    inputType: 'select',
    options: ['Rarely', '1-2 times/week', '3-5 times/week', 'Almost daily'],
    field: null,
    validate: noValidation,
    parse: (input: string) => input,
  },
  // Stage 8: Workout days
  {
    id: 'workoutDays',
    messages: ['How many days a week can you realistically work out?'],
    inputType: 'select',
    options: ['2-3 days', '4-5 days', '6 days', 'Every day'],
    field: null,
    validate: noValidation,
    parse: (input: string) => input,
  },
  // Stage 8: Workout time preference
  {
    id: 'workoutTime',
    messages: ['Do you prefer morning, afternoon, or evening workouts?'],
    inputType: 'select',
    options: ['Morning', 'Afternoon', 'Evening', 'No preference'],
    field: null,
    validate: noValidation,
    parse: (input: string) => input,
  },
  // Stage 9: Equipment
  {
    id: 'equipment',
    messages: ['Last thing — what equipment do you have access to? Pick all that apply. Type them separated by commas, or say "bodyweight only".'],
    inputType: 'text',
    field: null,
    validate: textNotEmpty,
    parse: (input: string) => input.trim(),
  },
  // Stage 10: Summary — messages are generated dynamically
  {
    id: 'summary',
    messages: [], // filled at runtime via buildSummary()
    inputType: 'select',
    options: ['Yes, that\'s right!', 'I need to correct something'],
    field: null,
    validate: noValidation,
    parse: (input: string) => input,
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
  pastSports: string;
  fitnessHistory: string;
  currentActivityLevel: string;
  injuries: string;
  dietType: string;
  allergies: string;
  cuisineRegion: string;
  cookingContext: string;
  eatingOut: string;
  workoutDays: string;
  workoutTime: string;
  equipment: string;
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
    pastSports: '',
    fitnessHistory: '',
    currentActivityLevel: '',
    injuries: '',
    dietType: '',
    allergies: '',
    cuisineRegion: '',
    cookingContext: '',
    eatingOut: '',
    workoutDays: '',
    workoutTime: '',
    equipment: '',
  };
}

// ─── Smart acknowledgments ───────────────────────────────────────────────────
// TODO: Replace with actual AI-generated acknowledgments via backend

export function generateSmartAcknowledgment(stageId: string, userResponse: string, data: OnboardingData): string | null {
  const response = userResponse.toLowerCase();

  switch (stageId) {
    case 'name':
      return `Great to meet you, ${userResponse.trim()}! Let's get to know you a bit better.`;

    case 'age':
      return Number(userResponse) >= 40
        ? `${data.name}, age is just context — plenty of people peak in their 40s and beyond. Let's work with what you've got.`
        : `Got it, ${data.name}. Let's keep going.`;

    case 'gender':
      return null; // no acknowledgment needed, move straight to next

    case 'height':
      return 'Noted.';

    case 'currentWeight': {
      const diff = data.currentWeight - (data.targetWeight || data.currentWeight);
      if (diff > 0) return "That's our starting line. We'll get you moving in the right direction.";
      return 'Got it, logged.';
    }

    case 'targetWeight': {
      const gap = Math.abs(data.currentWeight - Number(userResponse));
      if (gap > 20) return `That's an ambitious goal — I like it. We'll build a realistic timeline for that ${gap}kg shift.`;
      if (gap > 5) return 'Totally doable. We\'ll get there step by step.';
      return 'Nice, you\'re pretty close already. Let\'s fine-tune.';
    }

    case 'primaryGoal':
      if (response.includes('weight loss')) return 'Weight loss it is. We\'ll combine smart nutrition with the right training.';
      if (response.includes('muscle')) return 'Muscle building — we\'ll structure your training and nutrition to support growth.';
      if (response.includes('stamina')) return 'Endurance focus — we\'ll build your cardio base alongside strength.';
      return 'Got it. We\'ll tailor everything to that goal.';

    case 'pastSports': {
      if (response.includes('cricket')) return 'Nice — cricket builds solid lower body endurance and reflexes. That foundation will help.';
      if (response.includes('football') || response.includes('soccer')) return 'Football gives you great cardio and agility foundations. We can build on that.';
      if (response.includes('swimming')) return 'Swimming background means great shoulder mobility and cardio base. Excellent.';
      if (response.includes('gym') || response.includes('weight')) return 'You\'ve got lifting experience — that muscle memory will come back fast.';
      if (response.includes('running') || response.includes('marathon')) return 'A running background means your cardiovascular base is strong. Great starting point.';
      if (response.includes('basketball')) return 'Basketball — great for explosiveness and agility. That translates well.';
      if (response.includes('tennis') || response.includes('badminton')) return 'Racket sports build great hand-eye coordination and lateral movement. Solid base.';
      if (response.includes('none') || response.includes('no') || response.includes('not really'))
        return "No worries at all — everyone starts somewhere. We'll build from scratch together.";
      return 'Good to know your background. Every bit of past activity helps.';
    }

    case 'fitnessHistory':
      if (response.includes('still active')) return 'Great — you\'ve got momentum on your side.';
      if (response.includes('3+')) return 'It\'s been a while, but your body remembers more than you think. We\'ll ease back in.';
      return 'Got it. We\'ll factor that into how we ramp things up.';

    case 'currentActivityLevel':
      if (response.includes('sedentary')) return 'Honest answer — I respect that. We\'ll start gentle and build up.';
      if (response.includes('very active')) return 'You\'re already moving — now we just need to make it more targeted.';
      return 'Noted. We\'ll calibrate your plan to where you are now.';

    case 'injuries':
      if (response.includes('none')) return 'Clean bill of health — that gives us full flexibility.';
      return 'Thanks for sharing that. I\'ll make sure to work around any limitations in your plan.';

    case 'dietType':
      return null; // flow straight to next

    case 'allergies':
      if (response.includes('none')) return 'No restrictions — that makes meal planning easier!';
      return 'Noted — I\'ll keep those off your meal plans.';

    case 'cuisineRegion':
      return `${userResponse} cuisine — I'll make sure your meal suggestions actually feel like home.`;

    case 'cookingContext':
      return null;

    case 'eatingOut':
      if (response.includes('almost daily')) return 'No judgment — we\'ll just pick smarter options for eating out.';
      return null;

    case 'workoutDays':
      return 'Perfect — I\'ll design your split around that schedule.';

    case 'workoutTime':
      return `${userResponse} workouts it is.`;

    case 'equipment':
      return 'Got it — I\'ll only suggest exercises you can actually do. Almost done!';

    default:
      return null;
  }
}

// ─── Summary builder ─────────────────────────────────────────────────────────

export function buildSummary(data: OnboardingData): string {
  const goalMap: Record<string, string> = {
    'Weight Loss': 'lose weight',
    'Muscle Building': 'build muscle',
    'General Fitness': 'improve your overall fitness',
    'Stamina & Endurance': 'boost your stamina and endurance',
  };
  const goalText = goalMap[data.primaryGoal] || data.primaryGoal.toLowerCase();

  return (
    `Here's what I've got, ${data.name}:\n\n` +
    `You're ${data.age}, ${data.gender}, ${data.height}cm tall, currently at ${data.currentWeight}kg ` +
    `and aiming for ${data.targetWeight}kg. Your main goal is to ${goalText}.\n\n` +
    `Activity-wise, you've done ${data.pastSports.toLowerCase() === 'none' ? 'no prior sports' : data.pastSports} ` +
    `and you're currently ${data.currentActivityLevel.toLowerCase()}. ` +
    `${data.injuries.toLowerCase() === 'none' ? 'No injuries to worry about.' : `I'll work around your ${data.injuries}.`}\n\n` +
    `Food-wise, you're ${data.dietType}` +
    `${data.allergies.toLowerCase() === 'none' ? '' : ` with allergies to ${data.allergies}`}, ` +
    `eating ${data.cuisineRegion} cuisine mostly. ` +
    `${data.cookingContext}, eating out ${data.eatingOut.toLowerCase()}.\n\n` +
    `You can train ${data.workoutDays.toLowerCase()} per week, preferably in the ${data.workoutTime.toLowerCase()}.\n` +
    `${data.equipment ? `Equipment: ${data.equipment}.` : 'No specific equipment listed.'}\n\n` +
    `Does this sound right? Anything you want to correct?`
  );
}

// ─── Parse equipment text input ──────────────────────────────────────────────

function parseEquipmentInput(raw: string): string[] {
  if (!raw || raw.toLowerCase().includes('bodyweight only')) return ['Bodyweight'];
  const tokens = raw.split(/,\s*/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  const matched: string[] = [];
  for (const token of tokens) {
    const match = EQUIPMENT_OPTIONS.find((opt) => opt.toLowerCase() === token);
    if (match) matched.push(match);
  }
  // Always include Bodyweight if nothing else matched
  return matched.length > 0 ? matched : ['Bodyweight'];
}

// ─── Map collected data to UserProfile ───────────────────────────────────────

export function buildProfileFromData(userId: string, data: OnboardingData): UserProfile {
  const sportsArray = data.pastSports.toLowerCase() === 'none'
    ? []
    : data.pastSports.split(/,\s*|\s+and\s+|\s*&\s*/).map((s) => s.trim()).filter(Boolean);

  const injuriesArray = data.injuries.toLowerCase() === 'none'
    ? []
    : data.injuries.split(/,\s*/).map((s) => s.trim()).filter(Boolean);

  const allergiesArray = data.allergies.toLowerCase() === 'none'
    ? []
    : data.allergies.split(/,\s*/).map((s) => s.trim()).filter(Boolean);

  const dietTypeMap: Record<string, 'veg' | 'non-veg' | 'vegan'> = {
    veg: 'veg',
    'non-veg': 'non-veg',
    nonveg: 'non-veg',
    vegan: 'vegan',
  };

  const now = new Date().toISOString();

  return {
    userId,
    name: data.name,
    age: data.age,
    gender: data.gender,
    height: data.height,
    currentWeight: data.currentWeight,
    targetWeight: data.targetWeight,
    fitnessHistory: data.fitnessHistory,
    pastSports: sportsArray,
    peakFitnessLevel: data.fitnessHistory === 'Still active' ? 'active' : 'past',
    currentActivityLevel: data.currentActivityLevel,
    injuries: injuriesArray,
    dietaryPreferences: {
      type: dietTypeMap[data.dietType.toLowerCase().replace('-', '-')] ?? 'non-veg',
      allergies: allergiesArray,
      dislikes: [],
      cuisineRegion: data.cuisineRegion,
    },
    goals: {
      primaryGoal: data.primaryGoal,
      targetTimeline: '',
      targetWeight: data.targetWeight,
    },
    eatingContext: {
      cooksForSelf: data.cookingContext,
      eatsOutFrequency: data.eatingOut,
    },
    workoutSchedule: {
      daysPerWeek: data.workoutDays,
      timePreference: data.workoutTime,
    },
    equipmentAvailable: parseEquipmentInput(data.equipment),
    onboardingCompleted: true,
    createdAt: now,
    updatedAt: now,
  };
}

// ─── Correction stage mapping ────────────────────────────────────────────────

export const CORRECTION_STAGE_MAP: Record<string, number> = {};
ONBOARDING_STAGES.forEach((stage, index) => {
  CORRECTION_STAGE_MAP[stage.id] = index;
});

export const TOTAL_STAGES = ONBOARDING_STAGES.length;

// Map stage index to the user-facing step number (1-10)
export function getStepNumber(stageIndex: number): number {
  if (stageIndex <= 0) return 1;
  if (stageIndex <= 4) return 2;
  if (stageIndex <= 6) return 3;
  if (stageIndex <= 8) return 4;
  if (stageIndex <= 10) return 5;
  if (stageIndex <= 13) return 6;
  if (stageIndex <= 15) return 7;
  if (stageIndex <= 17) return 8;
  if (stageIndex <= 18) return 9;  // equipment
  return 10; // summary
}

export const TOTAL_USER_STEPS = 10;
