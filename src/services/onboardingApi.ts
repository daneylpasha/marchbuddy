import { supabase } from '../api/supabase';

interface GenerateReplyParams {
  step: string;
  userName: string;
  userInput: string | string[];
  previousAnswers?: Record<string, unknown>;
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
    return `Thanks for sharing that, ${fallbackName}. Let's keep going.`;
  }
};
