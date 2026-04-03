import { supabase } from '../api/supabase';

interface GenerateReplyParams {
  step: string;
  userName: string;
  userInput: string | string[];
  previousAnswers?: Record<string, unknown>;
}

// Pool of varied acknowledgment messages. {{name}} is replaced at runtime.
const ACKNOWLEDGMENT_POOL = [
  "Appreciated, {{name}}. Now let's move.",
  "That means a lot. Ready when you are, {{name}}.",
  "Got it, {{name}}. One step at a time.",
  "Thanks for being honest, {{name}}. That takes courage.",
  "Heard you loud and clear. Let's keep building, {{name}}.",
  "Love that, {{name}}. Let's channel it.",
  "Okay {{name}}, I'm with you. Let's go.",
  "Good stuff. Onward, {{name}}.",
  "Noted, {{name}}. This tells me a lot about you.",
  "That's a strong answer, {{name}}. Let's keep it rolling.",
  "I hear you, {{name}}. We'll work with that.",
  "Perfect. You're doing great, {{name}}.",
  "Really appreciate you sharing that, {{name}}. Let's continue.",
  "Nice, {{name}}. That's all I needed to know.",
  "{{name}}, you're making this easy. Next one.",
];

let lastFallbackIndex = -1;

function getRandomFallback(name: string): string {
  let index: number;
  do {
    index = Math.floor(Math.random() * ACKNOWLEDGMENT_POOL.length);
  } while (index === lastFallbackIndex && ACKNOWLEDGMENT_POOL.length > 1);
  lastFallbackIndex = index;
  return ACKNOWLEDGMENT_POOL[index].replace(/\{\{name\}\}/g, name);
}

export const generateCoachReply = async (
  params: GenerateReplyParams,
  fallbackName: string,
): Promise<string> => {
  try {
    const { data, error } = await supabase.functions.invoke('onboarding-reply', {
      body: params,
    });

    if (error) throw error;
    if (!data?.success || !data?.coachMessage) throw new Error('Empty response');

    return data.coachMessage as string;
  } catch (error) {
    console.error('Failed to generate coach reply:', error);
    return getRandomFallback(fallbackName);
  }
};
