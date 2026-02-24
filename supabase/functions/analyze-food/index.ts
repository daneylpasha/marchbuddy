import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { callClaudeJSON } from '../_shared/claude.ts';

interface RequestBody {
  imageBase64: string;
  userContext?: {
    dietaryPreferences?: Record<string, unknown>;
    todayCaloriesRemaining?: number;
  };
}

interface FoodAnalysis {
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: 'low' | 'medium' | 'high';
  suggestions: string;
}

const SYSTEM_PROMPT = `You are a food analysis AI. Analyze the food in this image and estimate its nutritional content.

Respond with valid JSON only:
{
  "description": "Brief description of the food",
  "calories": number,
  "protein": number (grams),
  "carbs": number (grams),
  "fat": number (grams),
  "confidence": "low" | "medium" | "high",
  "suggestions": "Portion estimation and dietary notes"
}

Be realistic with estimates. If you can identify the cuisine/dish specifically, mention it. Estimate based on visible portion size. Use "low" confidence when the image is unclear or the dish is hard to identify, "medium" when you're fairly sure, and "high" when the dish is clearly identifiable.`;

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body: RequestBody = await req.json();
    const { imageBase64, userContext } = body;

    let prompt = 'Analyze the food in this image and estimate its nutritional content.';
    if (userContext?.todayCaloriesRemaining !== undefined) {
      prompt += ` The user has ${userContext.todayCaloriesRemaining} calories remaining today.`;
    }
    if (userContext?.dietaryPreferences) {
      prompt += ` Dietary preferences: ${JSON.stringify(userContext.dietaryPreferences)}.`;
    }

    const result = await callClaudeJSON<FoodAnalysis>(
      SYSTEM_PROMPT,
      [{ role: 'user', content: prompt }],
      imageBase64,
      512,
    );

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('analyze-food error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to analyze food image',
        details: String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
